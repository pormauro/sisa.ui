<?php

namespace App\Handlers;

use Illuminate\Support\Facades\DB;

class ClientsHandler
{
    public function handle(array $op, string $batchId, string $now): ?array
    {
        $requestId = $op['request_id'] ?? null;
        if (!$requestId) {
            abort(400, 'request_id required');
        }

        $hash = md5($requestId);
        $exists = DB::table('sync_items')
            ->where('hash', $hash)
            ->exists();
        if ($exists) {
            return null;
        }

        $result = null;
        $action = $op['op'] ?? null;
        $entityId = $op['remote_id'] ?? null;
        if ($action === 'create') {
            $result = $this->create($op, $now);
            $entityId = $result['id'];
        } elseif ($action === 'update') {
            $result = $this->update($op, $now);
            $entityId = $op['remote_id'];
        } elseif ($action === 'delete') {
            $result = $this->delete($op, $now);
            $entityId = $op['remote_id'] ?? null;
        }

        DB::table('sync_items')->insert([
            'batch_id' => $batchId,
            'entity' => $op['entity'],
            'entity_id' => $entityId,
            'hash' => $hash,
            'payload' => json_encode($op),
            'status' => 'applied',
            'created_at' => $now,
            'updated_at' => $now,
        ]);

        DB::table('sync_history')->insert([
            'entity' => $op['entity'],
            'entity_id' => $entityId,
            'batch_id' => $batchId,
            'payload' => json_encode($op),
            'created_at' => $now,
        ]);

        return $result;
    }

    private function create(array $op, string $now): array
    {
        $payload = $op['data'] ?? [];
        $data = [
            'business_name' => $payload['business_name'] ?? null,
            'tax_id' => $payload['tax_id'] ?? null,
            'email' => $payload['email'] ?? null,
            'brand_file_id' => $payload['brand_file_id'] ?? null,
            'phone' => $payload['phone'] ?? null,
            'address' => $payload['address'] ?? null,
            'tariff_id' => $payload['tariff_id'] ?? null,
            'version' => 1,
            'created_at' => $now,
            'updated_at' => $now,
        ];

        $id = DB::table('clients')->insertGetId($data);

        return [
            'entity' => 'clients',
            'id' => $id,
            'version' => 1,
        ];
    }

    private function delete(array $op, string $now): array
    {
        if (!isset($op['remote_id'])) {
            abort(400, 'remote_id required');
        }

        $deleted = DB::table('clients')->where('id', $op['remote_id'])->delete();
        if (!$deleted) {
            abort(404, 'Client not found');
        }

        return [
            'entity' => 'clients',
            'id' => $op['remote_id'],
            'deleted' => true,
        ];
    }

    private function update(array $op, string $now): array
    {
        if (!isset($op['remote_id']) || !isset($op['if_match_version'])) {
            abort(400, 'if_match_version required');
        }

        $client = DB::table('clients')->where('id', $op['remote_id'])->first();
        if (!$client) {
            abort(404, 'Client not found');
        }

        if ((int) $client->version !== (int) $op['if_match_version']) {
            abort(409, 'conflict');
        }

        $payload = $op['data'] ?? [];
        $data = [
            'business_name' => $payload['business_name'] ?? $client->business_name,
            'tax_id' => $payload['tax_id'] ?? $client->tax_id,
            'email' => $payload['email'] ?? $client->email,
            'brand_file_id' => $payload['brand_file_id'] ?? $client->brand_file_id,
            'phone' => $payload['phone'] ?? $client->phone,
            'address' => $payload['address'] ?? $client->address,
            'tariff_id' => $payload['tariff_id'] ?? $client->tariff_id,
            'version' => $client->version + 1,
            'updated_at' => $now,
        ];

        DB::table('clients')->where('id', $op['remote_id'])->update($data);

        return [
            'entity' => 'clients',
            'id' => $op['remote_id'],
            'version' => $client->version + 1,
        ];
    }
}
