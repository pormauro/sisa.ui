<?php

namespace App\Controllers;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class SyncController
{
    public function postBatch(Request $request)
    {
        $payload = $request->all();
        $batchId = $payload['batch_id'] ?? null;
        $sinceHistoryId = $payload['since_history_id'] ?? null;
        $ops = $payload['ops'] ?? [];

        if (!$batchId || !is_array($ops)) {
            return response()->json(['error' => 'Invalid payload'], 422);
        }

        foreach ($ops as $op) {
            if (($op['entity'] ?? null) !== 'clients') {
                return response()->json(['error' => 'Unsupported entity'], 422);
            }
        }

        if (DB::table('sync_batches')->where('batch_id', $batchId)->exists()) {
            return response()->json(['status' => 'duplicate'], 200);
        }

        $now = date('Y-m-d H:i:s');
        DB::table('sync_batches')->insert([
            'batch_id' => $batchId,
            'payload' => json_encode($payload),
            'status' => 'processed',
            'created_at' => $now,
            'updated_at' => $now,
        ]);

        $sorted = $this->topologicalSort($ops);

        DB::beginTransaction();
        try {
            foreach ($sorted as $op) {
                $hash = md5(json_encode($op));
                $exists = DB::table('sync_items')
                    ->where('batch_id', $batchId)
                    ->where('entity', $op['entity'])
                    ->where('entity_id', $op['id'] ?? null)
                    ->where('hash', $hash)
                    ->exists();
                if ($exists) {
                    continue;
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
            DB::commit();
        } catch (\Throwable $e) {
            DB::rollBack();
            throw $e;
        }

        return response()->json(['status' => 'ok']);
    }

    private function topologicalSort(array $ops): array
    {
        $graph = [];
        $idMap = [];
        foreach ($ops as $index => $op) {
            $id = $op['id'] ?? (string) $index;
            $idMap[$id] = $op;
            $graph[$id] = $op['depends'] ?? [];
        }

        $sorted = [];
        $temp = [];
        $perm = [];
        $visit = function ($id) use (&$visit, &$graph, &$sorted, &$temp, &$perm, $idMap) {
            if (isset($perm[$id])) {
                return;
            }
            if (isset($temp[$id])) {
                throw new \RuntimeException('Cycle detected');
            }
            $temp[$id] = true;
            foreach ($graph[$id] as $dep) {
                if (isset($graph[$dep])) {
                    $visit($dep);
                }
            }
            $perm[$id] = true;
            $sorted[] = $idMap[$id];
        };

        foreach (array_keys($graph) as $id) {
            $visit($id);
        }

        return array_reverse($sorted);
    }
}
