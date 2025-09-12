<?php

namespace App\Handlers;

use Illuminate\Support\Facades\DB;

class ClientsHandler
{
    public function handle(array $op, string $batchId, string $now): ?array
    {
        $hash = md5(json_encode($op));
        $exists = DB::table('sync_items')
            ->where('batch_id', $batchId)
            ->where('entity', $op['entity'])
            ->where('entity_id', $op['id'] ?? null)
            ->where('hash', $hash)
            ->exists();
        if ($exists) {
            return null;
        }

        $result = null;
        $action = $op['op'] ?? null;
        if ($action === 'update') {
            $result = $this->update($op, $now);
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

        return $result;
    }

    private function update(array $op, string $now): array
    {
        if (!isset($op['id']) || !isset($op['if_match_version'])) {
            abort(400, 'if_match_version required');
        }

        $client = DB::table('clients')->where('id', $op['id'])->first();
        if (!$client) {
            abort(404, 'Client not found');
        }

        if ((int) $client->version !== (int) $op['if_match_version']) {
            abort(409, 'conflict');
        }

        $data = [
            'business_name' => $op['business_name'] ?? $client->business_name,
            'tax_id' => $op['tax_id'] ?? $client->tax_id,
            'email' => $op['email'] ?? $client->email,
            'brand_file_id' => $op['brand_file_id'] ?? $client->brand_file_id,
            'phone' => $op['phone'] ?? $client->phone,
            'address' => $op['address'] ?? $client->address,
            'tariff_id' => $op['tariff_id'] ?? $client->tariff_id,
            'version' => $client->version + 1,
            'updated_at' => $now,
        ];

        DB::table('clients')->where('id', $op['id'])->update($data);

        return [
            'entity' => 'clients',
            'id' => $op['id'],
            'version' => $client->version + 1,
        ];
    }
}
