<?php

namespace App\Handlers;

use Illuminate\Support\Facades\DB;

class ClientsHandler
{
    public function handle(array $op, string $batchId, string $now): void
    {
        $hash = md5(json_encode($op));
        $exists = DB::table('sync_items')
            ->where('batch_id', $batchId)
            ->where('entity', $op['entity'])
            ->where('entity_id', $op['id'] ?? null)
            ->where('hash', $hash)
            ->exists();
        if ($exists) {
            return;
        }

        DB::table('sync_items')->insert([
            'batch_id' => $batchId,
            'entity' => $op['entity'],
            'entity_id' => $op['id'] ?? null,
            'hash' => $hash,
            'payload' => json_encode($op),
            'status' => 'applied',
            'created_at' => $now,
            'updated_at' => $now,
        ]);

        DB::table('sync_history')->insert([
            'entity' => $op['entity'],
            'entity_id' => $op['id'] ?? null,
            'batch_id' => $batchId,
            'payload' => json_encode($op),
            'created_at' => $now,
        ]);
    }
}
