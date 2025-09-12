<?php

namespace {
    if (!function_exists('response')) {
        function response()
        {
            return new class {
                public function json($data, $status = 200)
                {
                    return new \Illuminate\Http\JsonResponse($data, $status);
                }
            };
        }
    }
}

namespace Tests {

use App\Controllers\SyncController;
use Illuminate\Container\Container;
use Illuminate\Database\Capsule\Manager as Capsule;
use Illuminate\Events\Dispatcher;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Facade;
use Illuminate\Support\Facades\DB;
use PHPUnit\Framework\TestCase;

class SyncControllerTest extends TestCase
{
    protected function setUp(): void
    {
        $capsule = new Capsule;
        $capsule->addConnection([
            'driver' => 'sqlite',
            'database' => ':memory:',
            'prefix' => '',
        ]);
        $container = new Container();
        $capsule->setEventDispatcher(new Dispatcher($container));
        $capsule->setAsGlobal();
        $capsule->bootEloquent();
        $container->instance('db', $capsule->getDatabaseManager());
        Facade::setFacadeApplication($container);

        DB::statement('DROP TABLE IF EXISTS sync_batches');
        DB::statement('DROP TABLE IF EXISTS sync_history');
        DB::statement('DROP TABLE IF EXISTS clients');
        DB::statement('DROP TABLE IF EXISTS sync_items');
        DB::statement('CREATE TABLE sync_batches (id INTEGER PRIMARY KEY AUTOINCREMENT, batch_id TEXT, payload TEXT, status TEXT, created_at TEXT, updated_at TEXT)');
        DB::statement('CREATE TABLE sync_history (id INTEGER PRIMARY KEY AUTOINCREMENT, entity TEXT, entity_id INTEGER NULL, batch_id TEXT, payload TEXT, snapshot TEXT, created_at TEXT)');
        DB::statement('CREATE TABLE clients (id INTEGER PRIMARY KEY AUTOINCREMENT, business_name TEXT, tax_id TEXT NULL, email TEXT NULL, brand_file_id INTEGER NULL, phone TEXT NULL, address TEXT NULL, tariff_id INTEGER NULL, version INTEGER DEFAULT 1, created_at TEXT, updated_at TEXT)');
        DB::statement('CREATE TABLE sync_items (id INTEGER PRIMARY KEY AUTOINCREMENT, batch_id TEXT, entity TEXT, entity_id INTEGER NULL, hash TEXT, payload TEXT, status TEXT, created_at TEXT, updated_at TEXT)');
    }

    public function testRejectsMissingIdempotencyKey()
    {
        $controller = new SyncController();
        $request = Request::create('/', 'POST', [], [], [], [], json_encode([
            'batch_id' => 'batch-1',
            'ops' => [],
        ]));
        $request->headers->set('Content-Type', 'application/json');

        $response = $controller->postBatch($request);

        $this->assertSame(400, $response->getStatusCode());
    }

    public function testRejectsMismatchedIdempotencyKey()
    {
        $controller = new SyncController();
        $request = Request::create('/', 'POST', [], [], [], [], json_encode([
            'batch_id' => 'batch-1',
            'ops' => [],
        ]));
        $request->headers->set('Content-Type', 'application/json');
        $request->headers->set('Idempotency-Key', 'other');

        $response = $controller->postBatch($request);

        $this->assertSame(400, $response->getStatusCode());
    }

    public function testDuplicateRequestReturnsDuplicateStatus()
    {
        $controller = new SyncController();
        $payload = [
            'batch_id' => 'batch-1',
            'ops' => [],
        ];

        $req1 = Request::create('/', 'POST', [], [], [], [], json_encode($payload));
        $req1->headers->set('Content-Type', 'application/json');
        $req1->headers->set('Idempotency-Key', 'batch-1');
        $resp1 = $controller->postBatch($req1);
        $this->assertSame(200, $resp1->getStatusCode());
        $data1 = $resp1->getData(true);
        $this->assertTrue($data1['ok']);
        $this->assertSame('batch-1', $data1['batch_id']);

        $req2 = Request::create('/', 'POST', [], [], [], [], json_encode($payload));
        $req2->headers->set('Content-Type', 'application/json');
        $req2->headers->set('Idempotency-Key', 'batch-1');
        $resp2 = $controller->postBatch($req2);
        $this->assertSame(200, $resp2->getStatusCode());
        $data2 = $resp2->getData(true);
        $this->assertTrue($data2['ok']);
        $this->assertSame('batch-1', $data2['batch_id']);
        $this->assertTrue($data2['duplicate']);
    }

    public function testProcessesClientCreateUpdateDeleteAndHistory()
    {
        $controller = new SyncController();

        $createPayload = [
            'batch_id' => 'batch-create',
            'since_history_id' => 0,
            'ops' => [
                [
                    'entity' => 'clients',
                    'op' => 'create',
                    'request_id' => 'r1',
                    'local_id' => 'l1',
                    'data' => [
                        'business_name' => 'Acme Inc',
                    ],
                ],
            ],
        ];

        $req1 = Request::create('/', 'POST', [], [], [], [], json_encode($createPayload));
        $req1->headers->set('Content-Type', 'application/json');
        $req1->headers->set('Idempotency-Key', 'batch-create');
        $resp1 = $controller->postBatch($req1);
        $this->assertSame(200, $resp1->getStatusCode());
        $data1 = $resp1->getData(true);
        $this->assertTrue($data1['ok']);
        $this->assertCount(1, $data1['results']);
        $createRes = $data1['results'][0];
        $remoteId = $createRes['remote_id'];
        $this->assertSame('r1', $createRes['request_id']);
        $this->assertSame('done', $createRes['status']);
        $this->assertSame(1, $createRes['version']);
        $this->assertNotNull($createRes['updated_at']);
        $this->assertSame(['l1' => $remoteId], $data1['map']['local_to_remote']);

        $history1 = $data1['history'];
        $this->assertSame(1, $history1['max_history_id']);
        $this->assertCount(1, $history1['changes']);
        $change1 = $history1['changes'][0];
        $this->assertSame('create', $change1['op']);
        $this->assertSame($remoteId, $change1['remote_id']);
        $this->assertSame('Acme Inc', $change1['snapshot']['business_name']);
        $this->assertSame(1, $change1['history_id']);

        $updatePayload = [
            'batch_id' => 'batch-update',
            'since_history_id' => $history1['max_history_id'],
            'ops' => [
                [
                    'entity' => 'clients',
                    'op' => 'update',
                    'request_id' => 'r2',
                    'remote_id' => $remoteId,
                    'if_match_version' => 1,
                    'data' => [
                        'business_name' => 'Acme LLC',
                    ],
                ],
            ],
        ];

        $req2 = Request::create('/', 'POST', [], [], [], [], json_encode($updatePayload));
        $req2->headers->set('Content-Type', 'application/json');
        $req2->headers->set('Idempotency-Key', 'batch-update');
        $resp2 = $controller->postBatch($req2);
        $this->assertSame(200, $resp2->getStatusCode());
        $data2 = $resp2->getData(true);
        $this->assertTrue($data2['ok']);
        $this->assertCount(1, $data2['results']);
        $updateRes = $data2['results'][0];
        $this->assertSame('r2', $updateRes['request_id']);
        $this->assertSame($remoteId, $updateRes['remote_id']);
        $this->assertSame(2, $updateRes['version']);
        $this->assertNotNull($updateRes['updated_at']);
        $this->assertSame([], $data2['map']['local_to_remote']);

        $history2 = $data2['history'];
        $this->assertSame(2, $history2['max_history_id']);
        $this->assertCount(1, $history2['changes']);
        $change2 = $history2['changes'][0];
        $this->assertSame('update', $change2['op']);
        $this->assertSame($remoteId, $change2['remote_id']);
        $this->assertSame('Acme LLC', $change2['snapshot']['business_name']);
        $this->assertSame(2, $change2['history_id']);

        $deletePayload = [
            'batch_id' => 'batch-delete',
            'since_history_id' => $history2['max_history_id'],
            'ops' => [
                [
                    'entity' => 'clients',
                    'op' => 'delete',
                    'request_id' => 'r3',
                    'remote_id' => $remoteId,
                ],
            ],
        ];

        $req3 = Request::create('/', 'POST', [], [], [], [], json_encode($deletePayload));
        $req3->headers->set('Content-Type', 'application/json');
        $req3->headers->set('Idempotency-Key', 'batch-delete');
        $resp3 = $controller->postBatch($req3);
        $this->assertSame(200, $resp3->getStatusCode());
        $data3 = $resp3->getData(true);
        $this->assertTrue($data3['ok']);
        $this->assertCount(1, $data3['results']);
        $deleteRes = $data3['results'][0];
        $this->assertSame('r3', $deleteRes['request_id']);
        $this->assertSame($remoteId, $deleteRes['remote_id']);
        $this->assertNull($deleteRes['version']);
        $this->assertNull($deleteRes['updated_at']);
        $this->assertSame([], $data3['map']['local_to_remote']);

        $history3 = $data3['history'];
        $this->assertSame(3, $history3['max_history_id']);
        $this->assertCount(1, $history3['changes']);
        $change3 = $history3['changes'][0];
        $this->assertSame('delete', $change3['op']);
        $this->assertSame($remoteId, $change3['remote_id']);
        $this->assertSame('Acme LLC', $change3['snapshot']['business_name']);
        $this->assertSame(3, $change3['history_id']);
    }
}

}
