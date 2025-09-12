<?php

namespace Tests;

use App\Handlers\ClientsHandler;
use Illuminate\Database\Capsule\Manager as Capsule;
use Illuminate\Events\Dispatcher;
use Illuminate\Container\Container;
use Illuminate\Support\Facades\Facade;
use PHPUnit\Framework\TestCase;

class ClientsHandlerTest extends TestCase
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

        // create required tables
        Capsule::schema()->create('clients', function ($table) {
            $table->increments('id');
            $table->string('business_name');
            $table->string('tax_id')->nullable();
            $table->string('email')->nullable();
            $table->bigInteger('brand_file_id')->nullable();
            $table->string('phone')->nullable();
            $table->text('address')->nullable();
            $table->bigInteger('tariff_id')->nullable();
            $table->integer('version')->default(1);
            $table->timestamps();
        });
        Capsule::schema()->create('sync_items', function ($table) {
            $table->increments('id');
            $table->string('batch_id');
            $table->string('entity');
            $table->bigInteger('entity_id')->nullable();
            $table->string('hash');
            $table->text('payload');
            $table->string('status');
            $table->timestamps();
        });
        Capsule::schema()->create('sync_history', function ($table) {
            $table->increments('id');
            $table->string('entity');
            $table->bigInteger('entity_id')->nullable();
            $table->string('batch_id');
            $table->text('payload');
            $table->text('snapshot')->nullable();
            $table->timestamp('created_at');
        });
    }

    public function testCreateAndDelete()
    {
        $handler = new ClientsHandler();
        $now = date('Y-m-d H:i:s');
        $batchId = 'batch-1';

        $createResult = $handler->handle([
            'entity' => 'clients',
            'op' => 'create',
            'request_id' => 'req-1',
            'local_id' => 'local-1',
            'data' => [
                'business_name' => 'Acme Inc',
            ],
        ], $batchId, $now);

        $this->assertSame('req-1', $createResult['request_id']);
        $this->assertSame('done', $createResult['status']);
        $id = $createResult['remote_id'];
        $this->assertNotNull($id);
        $this->assertSame(1, $createResult['version']);
        $this->assertNotNull($createResult['updated_at']);

        $client = Capsule::table('clients')->where('id', $id)->first();
        $this->assertNotNull($client);

        $deleteResult = $handler->handle([
            'entity' => 'clients',
            'op' => 'delete',
            'request_id' => 'req-2',
            'remote_id' => $id,
        ], $batchId, $now);

        $this->assertSame('done', $deleteResult['status']);
        $this->assertSame($id, $deleteResult['remote_id']);
        $this->assertNull($deleteResult['version']);
        $this->assertNull($deleteResult['updated_at']);
        $clientAfter = Capsule::table('clients')->where('id', $id)->first();
        $this->assertNull($clientAfter);

        $history = Capsule::table('sync_history')->where('entity', 'clients')->where('entity_id', $id)->orderBy('id')->get();
        $this->assertCount(2, $history); // create + delete

        $createPayload = json_decode($history[0]->payload, true);
        $deletePayload = json_decode($history[1]->payload, true);

        $this->assertSame($id, $createPayload['remote_id']);
        $this->assertArrayHasKey('updated_at', $createPayload);
        $this->assertSame($id, $deletePayload['remote_id']);
        $this->assertArrayHasKey('updated_at', $deletePayload);

        $this->assertNotNull($history[0]->snapshot);
        $this->assertNotNull($history[1]->snapshot);
        $deletedSnapshot = json_decode($history[1]->snapshot, true);
        $this->assertSame('Acme Inc', $deletedSnapshot['business_name']);
    }
}

