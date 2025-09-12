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
        $dbPath = sys_get_temp_dir() . '/sisa_ui_test.sqlite';
        if (file_exists($dbPath)) {
            unlink($dbPath);
        }

        touch($dbPath);

        $capsule = new Capsule;
        $capsule->addConnection([
            'driver' => 'sqlite',
            'database' => $dbPath,
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
        DB::statement('CREATE TABLE sync_batches (id INTEGER PRIMARY KEY AUTOINCREMENT, batch_id TEXT, payload TEXT, status TEXT, created_at TEXT, updated_at TEXT)');
        DB::statement('CREATE TABLE sync_history (id INTEGER PRIMARY KEY AUTOINCREMENT, entity TEXT, entity_id INTEGER NULL, batch_id TEXT, payload TEXT, snapshot TEXT, created_at TEXT)');
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

    public function testDuplicateRequestReturnsDuplicateFlag()
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
        $this->assertTrue($data2['duplicate']);
        $this->assertSame('batch-1', $data2['batch_id']);
    }
}

}
