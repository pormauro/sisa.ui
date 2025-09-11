<?php

use App\Controllers\SyncController;

$router->post('/sync/batch', [SyncController::class, 'postBatch']);
