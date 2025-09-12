<?php

namespace App\Controllers;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use App\Handlers\ClientsHandler;

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

        $idempotencyKey = $request->header('Idempotency-Key');
        if (!$idempotencyKey || $idempotencyKey !== $batchId) {
            return response()->json(['error' => 'Idempotency-Key header missing or does not match batch_id'], 400);
        }

        $handlers = [
            'clients' => new ClientsHandler(),
        ];

        foreach ($ops as $op) {
            $entity = $op['entity'] ?? null;
            if (!$entity || !isset($handlers[$entity]) || !isset($op['request_id'])) {
                return response()->json(['error' => 'Unsupported entity or missing request_id'], 400);
            }
        }

        if (DB::table('sync_batches')->where('batch_id', $batchId)->exists()) {
            return response()->json([
                'ok' => true,
                'batch_id' => $batchId,
                'duplicate' => true,
            ], 200);
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

        $results = [];
        $localToRemote = [];
        DB::beginTransaction();
        try {
            foreach ($sorted as $op) {
                $res = $handlers[$op['entity']]->handle($op, $batchId, $now);
                if ($res) {
                    $results[] = $res;
                    if (isset($op['local_id']) && isset($res['remote_id'])) {
                        $localToRemote[$op['local_id']] = $res['remote_id'];
                    }
                }
            }
            DB::commit();
        } catch (\Throwable $e) {
            DB::rollBack();
            throw $e;
        }

        $response = [
            'ok' => true,
            'batch_id' => $batchId,
            'results' => $results,
            'map' => [
                'local_to_remote' => $localToRemote,
            ],
        ];

        if ($sinceHistoryId !== null) {
            $historyRows = DB::table('sync_history')
                ->where('id', '>', $sinceHistoryId)
                ->orderBy('id')
                ->get();

            $maxHistoryId = $historyRows->max('id') ?? $sinceHistoryId;

            $changes = $historyRows
                ->map(function ($row) {
                    $payload = json_decode($row->payload, true);
                    $payload['snapshot'] = json_decode($row->snapshot, true);
                    return $payload;
                })
                ->all();

            $response['history'] = [
                'max_history_id' => $maxHistoryId,
                'changes' => $changes,
            ];
        }

        return response()->json($response);
    }

    private function topologicalSort(array $ops): array
    {
        $graph = [];
        $idMap = [];
        foreach ($ops as $index => $op) {
            $id = $op['request_id'] ?? (string) $index;
            $idMap[$id] = $op;
            $graph[$id] = $op['refs'] ?? [];
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
