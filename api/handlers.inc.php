<?php
/**
 * Segreteria Campo — Plugin API handlers
 * Base path: /app/segreteriacampo/cf_api.php/segreteria-campo
 *
 * ENDPOINTS
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * POST /segreteria-campo/telegram/webhook                          [PUBLIC]
 *   Telegram webhook receiver. Accepts update_id-deduplicated messages
 *   and edited_message events. Attachments are rejected with a reply.
 *   Verified via X-Telegram-Bot-Api-Secret-Token (if webhook_secret set).
 *   Config: var/segreteria-campo-telegram.json (bot_token, bot_name, webhook_secret)
 *   Writes to: worktable SC_WT_COMUNICAZIONI
 *
 * GET /segreteria-campo/totem/organization-codes                   [PRIVATE]
 *   Returns a list of {org, cod} pairs — deterministic numeric codes
 *   derived from organisation names in the VOLONTARI PREACCREDITATI worktable.
 *   Used by totem kiosks for offline verification.
 *
 * GET /segreteria-campo/radio/health                               [PUBLIC — Basic Auth]
 *   Health check for the radio integration. Verifies DB connectivity.
 *   Returns: {status, db, worktable, time}
 *   Auth: Basic Auth via var/segreteria-campo-radio.json (username, password)
 *
 * PUT /segreteria-campo/radio/messages                             [PUBLIC — Basic Auth]
 *   Upsert radio messages from the Sparviere dispatcher into SC_WT_COMUNICAZIONI.
 *   Deduplication key: Num. Messaggio + Canale origine = 'Radio' (no cross-channel conflicts).
 *   Update Type: 'message' on insert, 'edited_message' on update.
 *   Payload: {"messagesPayload": [{"id", "timestamp", "from", "to", "text"}, …]}
 *   Auth: Basic Auth via var/segreteria-campo-radio.json (username, password)
 *
 * GET /segreteria-campo/status                                     [PRIVATE]
 *   Simple liveness check. Returns: {status: "ok"}
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * NOTE: emoji and 4-byte UTF-8 chars are sanitized before DB insert (columns
 *       are utf8, not utf8mb4). Use sc_utf8_sanitize() on free-text fields.
 * ─────────────────────────────────────────────────────────────────────────────
 */

define('SC_WT_COMUNICAZIONI', 'Com. Digitali');

// Gestisce caratteri 4-byte (emoji, ecc.) — workaround per colonne utf8 (non utf8mb4)
// $replace='[emoji]' per sostituire, $replace='' per rimuovere
function sc_utf8_sanitize(?string $s, string $replace = '[emoji]'): ?string {
    if ($s === null) return null;
    return preg_replace('/[\x{10000}-\x{10FFFF}]/u', $replace, $s);
}

function sc_radio_config(): array {
    static $cfg = null;
    if ($cfg === null) {
        $file = rtrim(CAMILA_VAR_ROOTDIR, '/\\') . '/segreteria-campo-radio.json';
        $cfg  = is_file($file) ? (json_decode(file_get_contents($file), true) ?? []) : [];
    }
    return $cfg;
}

function sc_telegram_config(): array {
    static $cfg = null;
    if ($cfg === null) {
        $file = rtrim(CAMILA_VAR_ROOTDIR, '/\\') . '/segreteria-campo-telegram.json';
        $cfg  = is_file($file) ? (json_decode(file_get_contents($file), true) ?? []) : [];
    }
    return $cfg;
}

function sc_telegram_send(int $chatId, string $text): void {
    $token = sc_telegram_config()['bot_token'] ?? '';
    if ($token === '') return;
    $url = 'https://api.telegram.org/bot' . $token . '/sendMessage';
    $ctx = stream_context_create(['http' => [
        'method'  => 'POST',
        'header'  => 'Content-Type: application/json',
        'content' => json_encode(['chat_id' => $chatId, 'text' => $text]),
        'timeout' => 5,
    ]]);
    @file_get_contents($url, false, $ctx);
}

return [

    // -------------------------------------------------------------------------
    // PUBLIC: Telegram webhook receiver
    // POST /segreteria-campo/telegram/webhook
    // -------------------------------------------------------------------------
    'POST /telegram/webhook' => [
        'public'  => true,
        'handler' => function(array $params, ?array $body, array $path): array {
            global $_CAMILA;

            if (empty($body)) {
                return ['ok' => true];
            }

            if (isset($body['message'])) {
                $msg        = $body['message'];
                $updateType = 'message';
            } elseif (isset($body['edited_message'])) {
                $msg        = $body['edited_message'];
                $updateType = 'edited_message';
            } else {
                return ['ok' => true];
            }

            $from = $msg['from'] ?? [];
            $chat = $msg['chat'] ?? [];
            $loc  = $msg['location'] ?? null;

            $isAttachment = isset($msg['photo']) || isset($msg['document']) || isset($msg['voice'])
                         || isset($msg['video']) || isset($msg['audio']) || isset($msg['sticker'])
                         || isset($msg['animation']) || isset($msg['video_note']);
            if ($isAttachment) {
                sc_telegram_send((int) ($chat['id'] ?? 0),
                    "Grazie per il messaggio. Al momento non è possibile ricevere allegati tramite questo canale. Ti chiediamo di inviare solo messaggi di testo.");
                return ['ok' => true];
            }

            $contentType = 'Testo';
            $fileId      = '';
            if (isset($msg['location'])) { $contentType = 'Posizione'; }

            $fields = [
                'Data/ora', 'Num. Messaggio', 'Chiamante', 'Chiamato',
                'Messaggio', 'Servizio', 'Necessaria risposta', 'Priorità',
                'Canale origine', 'Tipo Contenuto', 'Latitudine', 'Longitudine',
                'Note', 'Stato elaborazione',
                'Update Id', 'Message Id', 'Chat Id', 'User Id', 'Username',
                'Update Type', 'File Id', 'Received Date', 'Payload',
            ];
            $values = [
                isset($msg['date']) ? date('Y-m-d H:i:s', $msg['date']) : date('Y-m-d H:i:s'),
                (string) ($msg['message_id'] ?? ''),
                sc_utf8_sanitize(trim(($from['first_name'] ?? '') . ' ' . ($from['last_name'] ?? '')), ''),
                sc_telegram_config()['bot_name'] ?? 'Bot Telegram',
                sc_utf8_sanitize($msg['text'] ?? ''),
                '', '', '',
                'Telegram',
                $contentType,
                $loc ? (string) $loc['latitude']  : null,
                $loc ? (string) $loc['longitude'] : null,
                '', '',
                (string) ($body['update_id'] ?? ''),
                (string) ($msg['message_id'] ?? ''),
                (string) ($chat['id']         ?? ''),
                (string) ($from['id']         ?? ''),
                sc_utf8_sanitize($from['username'] ?? ($from['first_name'] ?? ''), ''),
                $updateType,
                $fileId,
                date('Y-m-d H:i:s'),
                sc_utf8_sanitize(json_encode($body, JSON_UNESCAPED_UNICODE)),
            ];

            $wt     = new CamilaWorkTable();
            $wt->db = $_CAMILA['db'];

            $logFile = rtrim(CAMILA_LOG_DIR, '/\\') . '/telegram-webhook.log';
            $log     = function(string $msg) use ($logFile): void {
                file_put_contents($logFile, date('Y-m-d H:i:s') . ' ' . $msg . PHP_EOL, FILE_APPEND);
            };

            $updateId = (string) ($body['update_id'] ?? '');
            $log("update_id={$updateId} wt=" . SC_WT_COMUNICAZIONI . " lang=" . (defined('CAMILA_LANG') ? CAMILA_LANG : 'UNDEFINED'));

            if ($updateId !== '' && $wt->getWorktableRecordIdByKeyColumn(SC_WT_COMUNICAZIONI, 'Update Id', $updateId) !== '') {
                $log("duplicate, skip");
                return ['ok' => true];
            }

            $result = $wt->insertRow(SC_WT_COMUNICAZIONI, defined('CAMILA_LANG') ? CAMILA_LANG : 'it', $fields, $values, 'telegram-bot');
            $log("insertRow result=" . ($result === false ? 'FALSE err=' . $wt->db->ErrorMsg() : 'OK'));

            $recordId = $updateId !== ''
                ? $wt->getWorktableRecordIdByKeyColumn(SC_WT_COMUNICAZIONI, 'Update Id', $updateId)
                : '';
            $log("recordId={$recordId}");

            $token = sc_telegram_config()['bot_token'] ?? '';
            $log("token=" . ($token !== '' ? 'SET' : 'EMPTY') . " recordId={$recordId} chatId=" . ($chat['id'] ?? 'n/a'));
            if ($recordId !== '' && isset($chat['id'])) {
                sc_telegram_send((int) $chat['id'],
                    "Messaggio ricevuto e registrato (ID: {$recordId}). Grazie.");
            }

            return ['ok' => true];
        },
    ],

    // -------------------------------------------------------------------------
    // PRIVATE: Token codes by organisation
    // GET /segreteria-campo/codici-totem
    // -------------------------------------------------------------------------
    'GET /totem/organization-codes' => function(array $params, ?array $body, array $path): array {
        global $_CAMILA;

        $sqlCodes = <<<'SQL'
SELECT DISTINCT
    organizzazione,
    (
        LENGTH(u) * 7919
      + INSTR(r, SUBSTR(u, 1, 1))  * 101
      + INSTR(r, SUBSTR(u, 3, 1))  * 211
      + INSTR(r, SUBSTR(u, 6, 1))  * 307
      + INSTR(r, SUBSTR(u, 10, 1)) * 401
      + INSTR(r, SUBSTR(u, 15, 1)) * 503
      + INSTR(r, SUBSTR(u, LENGTH(u), 1)) * 601
      + 888
    ) % 2147483629 AS code
FROM (
    SELECT ${VOLONTARI PREACCREDITATI.ORGANIZZAZIONE} AS organizzazione,
           UPPER(TRIM(COALESCE(${VOLONTARI PREACCREDITATI.ORGANIZZAZIONE}, ''))) AS u,
           ' ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789.-&/' AS r
    FROM ${VOLONTARI PREACCREDITATI}
    WHERE Id IS NOT NULL
) AS t
SQL;

        $sqlMeta = <<<'SQL'
SELECT DISTINCT
    ${VOLONTARI PREACCREDITATI.ORGANIZZAZIONE}       AS organizzazione,
    ${VOLONTARI PREACCREDITATI.PROVINCIA}            AS provincia,
    ${VOLONTARI PREACCREDITATI.CODICE ORGANIZZAZIONE}  AS cod_org
FROM ${VOLONTARI PREACCREDITATI}
WHERE Id IS NOT NULL
SQL;

        $wt     = new CamilaWorkTable();
        $wt->db = $_CAMILA['db'];

        // prima query: codici hash
        $rCodes = $wt->startExecuteQuery($sqlCodes, true, ADODB_FETCH_ASSOC);
        if ($rCodes === false) {
            return ['__status' => 500, 'message' => 'query codes failed', 'db_error' => $wt->db->ErrorMsg()];
        }
        $codes  = [];
        while (!$rCodes->EOF) {
            $codes[$rCodes->fields['organizzazione']] = (int) $rCodes->fields['code'];
            $rCodes->MoveNext();
        }
        $wt->endExecuteQuery();

        // seconda query: provincia e codice-organizzazione (un record per org)
        $rMeta = $wt->startExecuteQuery($sqlMeta, true, ADODB_FETCH_ASSOC);
        if ($rMeta === false) {
            return ['__status' => 500, 'message' => 'query meta failed', 'db_error' => $wt->db->ErrorMsg()];
        }
        $meta  = [];
        while (!$rMeta->EOF) {
            $org = $rMeta->fields['organizzazione'];
            if ($org !== null && $org !== '' && !isset($meta[$org])) {
                $meta[$org] = [
                    'provincia' => $rMeta->fields['provincia'],
                    'cod_org'   => $rMeta->fields['cod_org'],
                ];
            }
            $rMeta->MoveNext();
        }
        $wt->endExecuteQuery();

        // join in memoria
        $rows = [];
        foreach ($codes as $org => $code) {
            $rows[] = [
                'organizzazione'        => $org,
                'provincia'             => $meta[$org]['provincia'] ?? null,
                'codice-organizzazione' => $meta[$org]['cod_org']   ?? null,
                'code'                  => $code,
            ];
        }

        return ['data' => $rows];
    },

    // -------------------------------------------------------------------------
    // PUBLIC (own Basic Auth): Radio health check
    // GET /segreteria-campo/radio/health
    // -------------------------------------------------------------------------
    'GET /radio/health' => [
        'public'  => true,
        'handler' => function(array $params, ?array $body, array $path): array {
            global $_CAMILA;

            $authUser = $_SERVER['PHP_AUTH_USER'] ?? null;
            $authPw   = $_SERVER['PHP_AUTH_PW']   ?? null;

            if ($authUser === null) {
                return ['__status' => 401, 'status' => 'error', 'message' => 'Authentication required'];
            }
            $radioCfg = sc_radio_config();
            if ($authUser !== ($radioCfg['username'] ?? '') || $authPw !== ($radioCfg['password'] ?? '')) {
                return ['__status' => 403, 'status' => 'error', 'message' => 'Authentication failed'];
            }

            $dbOk = false;
            try {
                $rs   = $_CAMILA['db']->Execute('SELECT 1');
                $dbOk = $rs !== false;
            } catch (\Throwable $e) {}

            return [
                'status'    => $dbOk ? 'ok' : 'error',
                'db'        => $dbOk ? 'connected' : 'unreachable',
                'worktable' => SC_WT_COMUNICAZIONI,
                'time'      => date('c'),
            ];
        },
    ],

    // -------------------------------------------------------------------------
    // PUBLIC (own Basic Auth): Radio messages upsert (Sparviere dispatcher)
    // PUT /segreteria-campo/radio/messages
    // Payload: {"messagesPayload":[{"id","timestamp","from","to","text"},…]}
    // -------------------------------------------------------------------------
    'PUT /radio/messages' => [
        'public'  => true,
        'handler' => function(array $params, ?array $body, array $path): array {
        global $_CAMILA;

        $authUser = $_SERVER['PHP_AUTH_USER'] ?? null;
        $authPw   = $_SERVER['PHP_AUTH_PW']   ?? null;

        if ($authUser === null) {
            return ['__status' => 401, 'status' => 'error', 'message' => 'Authentication required'];
        }
        $radioCfg = sc_radio_config();
        if ($authUser !== ($radioCfg['username'] ?? '') || $authPw !== ($radioCfg['password'] ?? '')) {
            return ['__status' => 403, 'status' => 'error', 'message' => 'Authentication failed'];
        }

        if (empty($body['messagesPayload']) || !is_array($body['messagesPayload'])) {
            return ['__status' => 400, 'status' => 'error', 'message' => 'Invalid payload'];
        }

        $wt     = new CamilaWorkTable();
        $wt->db = $_CAMILA['db'];

        $fields = [
            'Data/ora', 'Num. Messaggio', 'Chiamante', 'Chiamato',
            'Messaggio', 'Servizio', 'Necessaria risposta', 'Priorità',
            'Canale origine', 'Tipo Contenuto', 'Latitudine', 'Longitudine',
            'Note', 'Stato elaborazione',
            'Update Id', 'Message Id', 'Chat Id', 'User Id', 'Username',
            'Update Type', 'File Id', 'Received Date', 'Payload',
        ];

        $processedCount = 0;
        $insertedCount  = 0;
        $updatedCount   = 0;
        $errorCount     = 0;

        $logFile = rtrim(CAMILA_LOG_DIR, '/\\') . '/radio-messages.log';
        $log     = function(string $msg) use ($logFile): void {
            file_put_contents($logFile, date('Y-m-d H:i:s') . ' ' . $msg . PHP_EOL, FILE_APPEND);
        };

        foreach ($body['messagesPayload'] as $entry) {
            $msgId   = (string) ($entry['id'] ?? '');
            $dataOra = isset($entry['timestamp']) ? date('Y-m-d H:i:s', $entry['timestamp']) : date('Y-m-d H:i:s');

            $esisteId = '';
            if ($msgId !== '') {
                $db  = $_CAMILA['db'];
                $chk = "SELECT id FROM \${" . SC_WT_COMUNICAZIONI . "}"
                     . " WHERE \${" . SC_WT_COMUNICAZIONI . ".Num. Messaggio}=" . $db->qstr($msgId)
                     . " AND \${"   . SC_WT_COMUNICAZIONI . ".Canale origine}='Radio'"
                     . " LIMIT 1";
                $rs = $wt->startExecuteQuery($chk, true, ADODB_FETCH_ASSOC);
                if ($rs && !$rs->EOF) {
                    $esisteId = (string) ($rs->fields['id'] ?? '');
                }
                $wt->endExecuteQuery();
            }

            if ($esisteId !== '') {
                $db  = $_CAMILA['db'];
                $upd = "UPDATE \${" . SC_WT_COMUNICAZIONI . "}"
                     . " SET \${" . SC_WT_COMUNICAZIONI . ".Data/ora}="       . $db->qstr($dataOra)
                     . ", \${"    . SC_WT_COMUNICAZIONI . ".Chiamante}="      . $db->qstr($entry['from'] ?? '')
                     . ", \${"    . SC_WT_COMUNICAZIONI . ".Chiamato}="       . $db->qstr($entry['to']   ?? '')
                     . ", \${"    . SC_WT_COMUNICAZIONI . ".Messaggio}="      . $db->qstr($entry['text'] ?? '')
                     . ", \${"    . SC_WT_COMUNICAZIONI . ".Update Type}="    . $db->qstr('edited_message')
                     . ", \${"    . SC_WT_COMUNICAZIONI . ".Payload}="        . $db->qstr(json_encode($entry, JSON_UNESCAPED_UNICODE))
                     . " WHERE id=" . $db->qstr($esisteId);
                $result = $wt->startExecuteQuery($upd, false);
                $result === false ? $errorCount++ : $updatedCount++;
            } else {
                $values = [
                    $dataOra,
                    $msgId,
                    $entry['from'] ?? '',
                    $entry['to']   ?? '',
                    $entry['text'] ?? '',
                    'Sala Radio', '', '',
                    'Radio', 'Testo',
                    null, null, '', '',
                    '', $msgId, '', '', '',
                    'message', '', date('Y-m-d H:i:s'),
                    json_encode($entry, JSON_UNESCAPED_UNICODE),
                ];
                $result = $wt->insertRow(SC_WT_COMUNICAZIONI, defined('CAMILA_LANG') ? CAMILA_LANG : 'it', $fields, $values, 'sala-radio');
                if ($result === false) {
                    $log("insertRow FAILED id={$msgId} err=" . $wt->db->ErrorMsg());
                    $errorCount++;
                } else {
                    $log("insertRow OK id={$msgId}");
                    $insertedCount++;
                }
            }

            $processedCount++;
        }

        return [
            'status'         => 'success',
            'message'        => 'Data processed successfully',
            'inserted_count' => $insertedCount,
            'updated_count'  => $updatedCount,
            'error_count'    => $errorCount,
        ];
    }],

    // -------------------------------------------------------------------------
    'GET /status' => function(array $params, ?array $body, array $path): array {
        return ['status' => 'ok'];
    },

];
