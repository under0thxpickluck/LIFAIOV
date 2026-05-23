// ==============================
// LIFAI GAS WebApp (POST/GET 安全対応) - 完全統合版（RESET TOKEN + MAIL）Code.gs
// ✅ 既存機能は削除しない（apply_create / payment_update / apply / admin_list / admin_approve / login）
// ✅ 追加機能：reset_password + reset_token列 + Mail送信
// ✅ 構造を壊さないため、各action内で必要列を必ず ensureCols_ してから idx を作る
// ✅ 追加機能（今回）：紹介コード発行 + 紹介者紐づけ(最大3段追跡) + ref_tree自動生成 + ref_events記録
// ✅ 追加機能（今回）：me（ログイン済ユーザーの紹介情報を返す）
// ✅ 追加機能（今回）：get_balance（BP/EP残高取得）
// ✅ 追加修正（今回）：ref_tree_build の getDataRange() を安全化（巨大DataRangeで落ちるサーバーエラー回避）
// ✅ 追加改善（今回）：payment_update で金額OKなら自動承認 + 自動メール送信、NGは pending_error に残す（壊さない）
// ✅ 追加改善（今回）：NOWPaymentsの pay_amount/pay_currency/price_amount/price_currency を保存（壊さない）
// ✅ 追加機能（今回）：approved になった瞬間にBP/EPを付与（bp_granted_at で二重付与防止）（壊さない）
// ==============================

function onOpen() {
  try {
    SpreadsheetApp.getUi()
      .createMenu("LIFAI")
      .addItem("紹介ツリー更新", "buildRefTreeManual_")
      .addToUi();
  } catch (e) {
    // WebApp実行時などUIが無い場合は何もしない（壊さない）
  }
}

function buildRefTreeManual_() {
  // 管理者がシートから実行する用（壊さない）
  // adminKey はスクリプトプロパティの ADMIN_SECRET を使う
  const secrets = getSecrets_();
  const body = { action: "ref_tree_build", adminKey: secrets.ADMIN_SECRET };
  // pickKey_ は不要（シート実行は handle_ 直で呼ぶ）
  return handle_(secrets.SECRET, body);
}

// NOTE: これらの doGet/doPost 定義は後方の定義（最終定義）に上書きされるため無効です。
// 最終有効定義: doPost @ 5788行付近, doGet @ 5911行付近
/*
function doGet(e) {
  try {
    const key = pickKey_(e);
    const action = str_(e?.parameter?.action);

    const pseudoBody = {
      action,

      // admin系
      adminKey: str_(e?.parameter?.adminKey),
      rowIndex: num_(e?.parameter?.rowIndex),

      // login/me系（GET互換）
      id: str_(e?.parameter?.id),
      code: str_(e?.parameter?.code),

      // apply系
      plan: str_(e?.parameter?.plan),
      email: str_(e?.parameter?.email),
      name: str_(e?.parameter?.name),
      nameKana: str_(e?.parameter?.nameKana),
      discordId: str_(e?.parameter?.discordId),
      ageBand: str_(e?.parameter?.ageBand),
      prefecture: str_(e?.parameter?.prefecture),
      city: str_(e?.parameter?.city),
      job: str_(e?.parameter?.job),
      refName: str_(e?.parameter?.refName),
      refId: str_(e?.parameter?.refId),

      // ✅ 紹介コード（今回追加：壊さない）
      refCode: str_(e?.parameter?.refCode),

      // 互換用（古い region が来ても壊れない）
      region: str_(e?.parameter?.region),

      applyId: str_(e?.parameter?.applyId),

      // payment_update系
      orderId: str_(e?.parameter?.orderId),
      paymentStatus: str_(e?.parameter?.paymentStatus),
      isPaid: str_(e?.parameter?.isPaid),
      invoiceId: str_(e?.parameter?.invoiceId),
      actuallyPaid: str_(e?.parameter?.actuallyPaid),

      // ✅ NOWPayments金額・通貨（今回追加：壊さない）
      payAmount: str_(e?.parameter?.payAmount),
      payCurrency: str_(e?.parameter?.payCurrency),
      priceAmount: str_(e?.parameter?.priceAmount),
      priceCurrency: str_(e?.parameter?.priceCurrency),

      // reset_password系
      token: str_(e?.parameter?.token),
      password: str_(e?.parameter?.password),
    };

    if (!action) {
      return json_({ ok: false, error: "method_not_allowed" });
    }

    return handle_(key, pseudoBody);
  } catch (err) {
    return json_({ ok: false, error: String(err) });
  }
}

function doPost(e) {
  try {
    const key = pickKey_(e);
    const body = JSON.parse(e?.postData?.contents || "{}");
    return handle_(key, body);
  } catch (err) {
    return json_({ ok: false, error: String(err) });
  }
}
*/

function handle_(key, body) {
  const secrets = getSecrets_();
  const SECRET = secrets.SECRET;
  const ADMIN_SECRET = secrets.ADMIN_SECRET;

  if (key !== SECRET) return json_({ ok: false, error: "unauthorized" });

  const sheet = getOrCreateSheet_();
  const action = str_(body.action);

  // =========================================================
  // 0) apply_create（仮登録：purchase時）
  // =========================================================
  if (action === "apply_create") {
    const plan = str_(body.plan);
    const applyId = str_(body.applyId);

    if (!plan || !applyId) {
      return json_({ ok: false, error: "missing_plan_or_applyId" });
    }

    let values = sheet.getDataRange().getValues();
    let header = values[0];

    ensureCols_(sheet, header, [
      "apply_id",
      "payment_status",
      "paid_at",
      "order_id",
      "invoice_id",
      "actually_paid",

      // ✅ NOWPayments金額・通貨（今回追加：壊さない）
      "pay_amount",
      "pay_currency",
      "price_amount",
      "price_currency",

      "discord_id",
      "age_band",
      "prefecture",
      "city",
      "job",
      "ref_name",
      "ref_id",
      "region",
      "login_id",
      "pw_hash",
      "pw_updated_at",
      "reset_token",
      "reset_expires",
      "reset_used_at",
      "reset_sent_at",

      // ✅ 紹介コード（今回追加：壊さない）
      "my_ref_code",
      "ref_code",
      "referrer_login_id",
      "referrer_2_login_id",
      "referrer_3_login_id",
      "ref_path",

      // ✅ 自動承認（今回追加：壊さない）
      "expected_paid",
      "auto_approved_at",
      "auto_approve_reason",

      // ✅ BP/EP付与（今回追加：壊さない）
      "bp_balance",
      "ep_balance",
      "bp_granted_at",
      "bp_grant_plan",
      "bp_grant_amount",
      "ep_grant_amount",

      // ✅ 紹介配当（今回追加：壊さない）
      "ref_share_pct",
      "ref_bonus_granted_at",
      "ref_bonus_amount",
    ]);

    values = sheet.getDataRange().getValues();
    header = values[0];

    const idx = indexMap_(header);
    const rows = values.slice(1);

    // 既に存在するかチェック（重複防止）
    for (let i = 0; i < rows.length; i++) {
      if (str_(rows[i][idx["apply_id"]]) === applyId) {
        // 既存行がある場合でも expected_paid が空なら埋める（壊さない）
        try {
          const rowIndex = i + 2;
          const curExpected = sheet.getRange(rowIndex, idx["expected_paid"] + 1).getValue();
          if (!curExpected) {
            const exp = planToExpectedPaid_(plan);
            if (exp > 0) {
              sheet.getRange(rowIndex, idx["expected_paid"] + 1).setValue(exp);
            }
          }
        } catch (e) {}
        return json_({ ok: true, already_exists: true });
      }
    }

    const row = new Array(header.length).fill("");
    row[idx["created_at"]] = new Date();
    row[idx["plan"]] = plan;
    row[idx["status"]] = "pending_payment";
    row[idx["apply_id"]] = applyId;

    // ✅ 期待金額（自動承認用）
    const exp = planToExpectedPaid_(plan);
    if (exp > 0) {
      row[idx["expected_paid"]] = exp;
    } else {
      row[idx["expected_paid"]] = "";
    }

    sheet.appendRow(row);
    return json_({ ok: true });
  }

  // =========================================================
  // 1) payment_update（着金ステータス更新）
  // ✅ 追加：金額OKなら自動承認 + メール送信、NGは pending_error に残す（壊さない）
  // =========================================================
  if (action === "payment_update") {
    const applyId = str_(body.applyId);
    const orderId = str_(body.orderId);
    const paymentStatus = str_(body.paymentStatus);
    const invoiceId = str_(body.invoiceId);
    const actuallyPaid = str_(body.actuallyPaid);

    // ✅ NOWPayments金額・通貨（今回追加：壊さない）
    const payAmount = str_(body.payAmount || body.pay_amount);
    const payCurrency = str_(body.payCurrency || body.pay_currency);
    const priceAmount = str_(body.priceAmount || body.price_amount);
    const priceCurrency = str_(body.priceCurrency || body.price_currency);

    if (!applyId && !orderId) {
      return json_({ ok: false, error: "missing_applyId_or_orderId" });
    }

    let values = sheet.getDataRange().getValues();
    let header = values[0];

    // ✅ 必要列保証（壊さない）
    ensureCols_(sheet, header, [
      "apply_id",
      "payment_status",
      "paid_at",
      "order_id",
      "invoice_id",
      "actually_paid",

      // ✅ NOWPayments金額・通貨（今回追加：壊さない）
      "pay_amount",
      "pay_currency",
      "price_amount",
      "price_currency",

      "status",
      "plan",
      "email",

      // ✅ admin_approveと共通化のために必要列（壊さない）
      "login_id",
      "pw_hash",
      "pw_updated_at",
      "reset_token",
      "reset_expires",
      "reset_used_at",
      "reset_sent_at",
      "my_ref_code",
      "ref_code",
      "referrer_login_id",
      "referrer_2_login_id",
      "referrer_3_login_id",
      "ref_path",

      // ✅ 自動承認（今回追加：壊さない）
      "expected_paid",
      "auto_approved_at",
      "auto_approve_reason",

      // ✅ BP/EP付与（今回追加：壊さない）
      "bp_balance",
      "ep_balance",
      "bp_granted_at",
      "bp_grant_plan",
      "bp_grant_amount",
      "ep_grant_amount",

      // ✅ 紹介配当（今回追加：壊さない）
      "ref_share_pct",
      "ref_bonus_granted_at",
      "ref_bonus_amount",
    ]);

    values = sheet.getDataRange().getValues();
    header = values[0];

    const idx = indexMap_(header);
    const rows = values.slice(1);

    let targetRowIndex = 0;

    for (let i = 0; i < rows.length; i++) {
      const rowIndex = i + 2;

      if (applyId && str_(rows[i][idx["apply_id"]]) === applyId) {
        targetRowIndex = rowIndex;
        break;
      }
      if (!applyId && orderId && str_(rows[i][idx["order_id"]]) === orderId) {
        targetRowIndex = rowIndex;
        break;
      }
      // 念のため：applyIdとorderId両方来た場合
      if (applyId && orderId && str_(rows[i][idx["order_id"]]) === orderId) {
        targetRowIndex = rowIndex;
        break;
      }
    }

    if (!targetRowIndex) {
      return json_({ ok: false, error: "apply_not_found" });
    }

    sheet.getRange(targetRowIndex, idx["payment_status"] + 1).setValue(paymentStatus);
    sheet.getRange(targetRowIndex, idx["order_id"] + 1).setValue(orderId);
    sheet.getRange(targetRowIndex, idx["invoice_id"] + 1).setValue(invoiceId);
    sheet.getRange(targetRowIndex, idx["actually_paid"] + 1).setValue(actuallyPaid);

    // ✅ NOWPayments金額・通貨を保存（壊さない）
    if (idx["pay_amount"] !== undefined) sheet.getRange(targetRowIndex, idx["pay_amount"] + 1).setValue(payAmount);
    if (idx["pay_currency"] !== undefined) sheet.getRange(targetRowIndex, idx["pay_currency"] + 1).setValue(payCurrency);
    if (idx["price_amount"] !== undefined) sheet.getRange(targetRowIndex, idx["price_amount"] + 1).setValue(priceAmount);
    if (idx["price_currency"] !== undefined) sheet.getRange(targetRowIndex, idx["price_currency"] + 1).setValue(priceCurrency);

    // isPaid は boolean/文字列 "true"/"1" も拾う
    const paid =
      body.isPaid === true ||
      String(body.isPaid).toLowerCase() === "true" ||
      String(body.isPaid) === "1";

    // ✅ paid の確定ステータス（壊さない）
    const paidOk =
      paid && (paymentStatus === "finished" || paymentStatus === "confirmed" || paymentStatus === "paid");

    if (paidOk) {
      sheet.getRange(targetRowIndex, idx["paid_at"] + 1).setValue(new Date());
      sheet.getRange(targetRowIndex, idx["status"] + 1).setValue("paid");
    }

    // ✅ 自動承認判定（壊さない）
    // - 原則：confirmed / finished のみ自動承認対象（paid でも来る場合があるので許容）
    // - 金額が判定できない/不足/メール無し/plan不明などは pending_error に残す
    // - 二重送信防止：reset_sent_at があれば送らない
    let autoApproved = false;
    let autoReason = "";

    if (paidOk) {
      const curStatus = str_(sheet.getRange(targetRowIndex, idx["status"] + 1).getValue());

      // approved 済みなら何もしない（壊さない）
      if (curStatus === "approved") {
        autoApproved = false;
        autoReason = "already_approved";
      } else {
        // email 必須（applyが未入力だとここで落とす）
        const email = str_(sheet.getRange(targetRowIndex, idx["email"] + 1).getValue());
        if (!email || email === "temp@pending.com" || email.endsWith("@pending.com")) {
          sheet.getRange(targetRowIndex, idx["status"] + 1).setValue("pending_error");
          sheet.getRange(targetRowIndex, idx["auto_approve_reason"] + 1).setValue("no_email");
          autoApproved = false;
          autoReason = "no_email";
        } else {
          // expected_paid の確定（空なら plan から埋める）
          const plan = str_(sheet.getRange(targetRowIndex, idx["plan"] + 1).getValue());
          let expected = Number(sheet.getRange(targetRowIndex, idx["expected_paid"] + 1).getValue() || 0);
          if (!expected || !Number.isFinite(expected) || expected <= 0) {
            const exp2 = planToExpectedPaid_(plan);
            if (exp2 > 0) {
              expected = exp2;
              sheet.getRange(targetRowIndex, idx["expected_paid"] + 1).setValue(expected);
            }
          }

          // ✅ 支払い額の優先順位：pay_amount -> actually_paid（壊さない）
          const payAmountCell =
            idx["pay_amount"] !== undefined ? sheet.getRange(targetRowIndex, idx["pay_amount"] + 1).getValue() : "";
          const apPay = parseMoneyLike_(payAmountCell);
          const apFallback = parseMoneyLike_(sheet.getRange(targetRowIndex, idx["actually_paid"] + 1).getValue());
          const ap = apPay > 0 ? apPay : apFallback;
          const TOLERANCE_PCT = 2;
          const expectedOk = expected > 0 && Number.isFinite(expected);
          const paidAmountOk = expectedOk && ap >= expected * (1 - TOLERANCE_PCT / 100);

          if (!expectedOk) {
            sheet.getRange(targetRowIndex, idx["status"] + 1).setValue("pending_error");
            sheet.getRange(targetRowIndex, idx["auto_approve_reason"] + 1).setValue("expected_unknown");
            autoApproved = false;
            autoReason = "expected_unknown";
          } else if (!Number.isFinite(ap) || ap <= 0) {
            sheet.getRange(targetRowIndex, idx["status"] + 1).setValue("pending_error");
            sheet.getRange(targetRowIndex, idx["auto_approve_reason"] + 1).setValue("actually_paid_invalid");
            autoApproved = false;
            autoReason = "actually_paid_invalid";
          } else if (!paidAmountOk) {
            sheet.getRange(targetRowIndex, idx["status"] + 1).setValue("pending_error");
            sheet.getRange(targetRowIndex, idx["auto_approve_reason"] + 1).setValue(
              "paid_too_low: " + String(ap) + " < " + String(expected)
            );
            autoApproved = false;
            autoReason = "paid_too_low";
          } else {
            // 二重送信防止（reset_sent_at があれば送らない）
            const sentAt = sheet.getRange(targetRowIndex, idx["reset_sent_at"] + 1).getValue();
            if (sentAt) {
              // 送信済みなら approved だけ整合させる（壊さない）
              sheet.getRange(targetRowIndex, idx["status"] + 1).setValue("approved");
              autoApproved = false;
              autoReason = "already_sent";
              sheet.getRange(targetRowIndex, idx["auto_approve_reason"] + 1).setValue("already_sent");
            } else {
              // ✅ admin_approve と同じ処理を実行（共通化）
              const res = approveRowCore_(sheet, header, idx, targetRowIndex, "auto_payment_update");
              if (res && res.ok) {
                autoApproved = true;
                autoReason = "auto_approved";
                sheet.getRange(targetRowIndex, idx["auto_approved_at"] + 1).setValue(new Date());
                sheet.getRange(targetRowIndex, idx["auto_approve_reason"] + 1).setValue("auto_payment_update_ok");
              } else {
                sheet.getRange(targetRowIndex, idx["status"] + 1).setValue("pending_error");
                sheet.getRange(targetRowIndex, idx["auto_approve_reason"] + 1).setValue(
                  "approve_failed: " + (res && res.error ? String(res.error) : "unknown")
                );
                autoApproved = false;
                autoReason = "approve_failed";
              }
            }
          }
        }
      }
    }

    return json_({ ok: true, autoApproved: autoApproved, autoReason: autoReason });
  }

  // =========================================================
  // 2-a) apply_5000（/5000グループ専用：別スプレッドシートに書き込み）
  // =========================================================
  if (action === "apply_5000") {
    const plan = str_(body.plan);
    const email = str_(body.email);
    const name = str_(body.name);
    const nameKana = str_(body.nameKana);

    if (!plan || !email || !name || !nameKana) {
      return json_({ ok: false, error: "missing_fields" });
    }

    const applyId = str_(body.applyId) || ("5000_" + Date.now());

    const ssId = PropertiesService.getScriptProperties().getProperty("SPREADSHEET_5000_ID");
    if (!ssId) return json_({ ok: false, error: "SPREADSHEET_5000_ID not set" });

    const ss5000 = SpreadsheetApp.openById(ssId);
    let sheet5000 = ss5000.getSheetByName("applies");
    if (!sheet5000) {
      sheet5000 = ss5000.insertSheet("applies");
      sheet5000.appendRow(["created_at","apply_id","plan","email","name","name_kana","age_band","prefecture","city","job","ref_name","ref_id","status"]);
      // ensureCols_ は下で idx5000 構築後に呼び出す
    }

    let header5000 = sheet5000.getDataRange().getValues()[0];
    const idx5000 = {};
    header5000.forEach(function(h, i) { idx5000[h] = i; });

    // 既存シートにも新列を保証（後方互換）
    ensureCols_(sheet5000, header5000, [
      "expected_paid", "payment_id", "payment_status", "actually_paid",
      "pay_currency", "paid_at", "approved_at", "last_ipn_at",
      "auto_approve_reason", "login_id", "pw_hash", "pw_updated_at",
      "reset_token", "reset_expires", "reset_used_at", "reset_sent_at",
      "my_ref_code", "mail_error", "referral_processed_at"
    ]);
    // ensureCols_ 後にヘッダー再取得
    const lastCol5000 = sheet5000.getLastColumn();
    header5000 = sheet5000.getRange(1, 1, 1, lastCol5000).getValues()[0];
    header5000.forEach(function(h, i) { idx5000[h] = i; });

    const planAmountMap5000 = { "500": 500, "2000": 2000, "3000": 3000, "5000": 5000 };

    // 既存行を検索
    const data5000 = sheet5000.getDataRange().getValues().slice(1);
    let targetRow5000 = 0;
    for (let i = 0; i < data5000.length; i++) {
      if (String(data5000[i][idx5000["apply_id"]] || "") === applyId) {
        targetRow5000 = i + 2;
        break;
      }
    }

    if (!targetRow5000) {
      // 新規行追記
      const newRow5000 = new Array(header5000.length).fill("");
      newRow5000[idx5000["created_at"]] = new Date();
      newRow5000[idx5000["apply_id"]] = applyId;
      newRow5000[idx5000["plan"]] = plan;
      newRow5000[idx5000["email"]] = email;
      newRow5000[idx5000["name"]] = name;
      newRow5000[idx5000["name_kana"]] = nameKana;
      newRow5000[idx5000["age_band"]] = str_(body.ageBand);
      newRow5000[idx5000["prefecture"]] = str_(body.prefecture);
      newRow5000[idx5000["city"]] = str_(body.city);
      newRow5000[idx5000["job"]] = str_(body.job);
      newRow5000[idx5000["ref_name"]] = str_(body.refName);
      newRow5000[idx5000["ref_id"]] = str_(body.refId);
      newRow5000[idx5000["status"]] = "pending_payment";
      if (idx5000["expected_paid"] !== undefined) {
        newRow5000[idx5000["expected_paid"]] = planAmountMap5000[plan] || 0;
      }
      sheet5000.appendRow(newRow5000);
    } else {
      // 既存行を更新
      sheet5000.getRange(targetRow5000, idx5000["plan"] + 1).setValue(plan);
      sheet5000.getRange(targetRow5000, idx5000["email"] + 1).setValue(email);
      sheet5000.getRange(targetRow5000, idx5000["name"] + 1).setValue(name);
      sheet5000.getRange(targetRow5000, idx5000["name_kana"] + 1).setValue(nameKana);
      sheet5000.getRange(targetRow5000, idx5000["age_band"] + 1).setValue(str_(body.ageBand));
      sheet5000.getRange(targetRow5000, idx5000["prefecture"] + 1).setValue(str_(body.prefecture));
      sheet5000.getRange(targetRow5000, idx5000["city"] + 1).setValue(str_(body.city));
      sheet5000.getRange(targetRow5000, idx5000["job"] + 1).setValue(str_(body.job));
      sheet5000.getRange(targetRow5000, idx5000["ref_name"] + 1).setValue(str_(body.refName));
      sheet5000.getRange(targetRow5000, idx5000["ref_id"] + 1).setValue(str_(body.refId));
      // expected_paid が未設定なら設定する
      if (idx5000["expected_paid"] !== undefined) {
        const existingExpected = sheet5000.getRange(targetRow5000, idx5000["expected_paid"] + 1).getValue();
        if (!existingExpected) {
          sheet5000.getRange(targetRow5000, idx5000["expected_paid"] + 1).setValue(planAmountMap5000[plan] || 0);
        }
      }
      // status が pending なら pending_payment に更新
      const existingStatus5000 = str_(sheet5000.getRange(targetRow5000, idx5000["status"] + 1).getValue());
      if (existingStatus5000 === "pending") {
        sheet5000.getRange(targetRow5000, idx5000["status"] + 1).setValue("pending_payment");
      }
    }

    return json_({ ok: true, apply_id: applyId });
  }

  // =========================================================
  // 2) apply（申請フォーム：apply_id の行を更新）
  // =========================================================
  if (action === "apply") {
    const plan = str_(body.plan);
    const email = str_(body.email);
    const name = str_(body.name);
    const nameKana = str_(body.nameKana);

    if (!plan || !email || !name || !nameKana) {
      return json_({ ok: false, error: "missing_fields" });
    }

    const applyId = str_(body.applyId);
    if (!applyId) {
      return json_({ ok: false, error: "missing_applyId" });
    }

    let values = sheet.getDataRange().getValues();
    let header = values[0];

    // ✅ 必要列保証（壊さない）
    ensureCols_(sheet, header, [
      "apply_id",
      "plan",
      "email",
      "name",
      "name_kana",
      "discord_id",
      "age_band",
      "prefecture",
      "city",
      "job",
      "ref_name",
      "ref_id",
      "region",
      "status",

      // ✅ 紹介コード（今回追加：壊さない）
      "ref_code",

      // ✅ 自動承認（今回追加：壊さない）
      "expected_paid",
      "auto_approved_at",
      "auto_approve_reason",

      // ✅ BP/EP付与（今回追加：壊さない）
      "bp_balance",
      "ep_balance",
      "bp_granted_at",
      "bp_grant_plan",
      "bp_grant_amount",
      "ep_grant_amount",

      // ✅ 紹介配当（今回追加：壊さない）
      "ref_share_pct",
      "ref_bonus_granted_at",
      "ref_bonus_amount",

      // ✅ Bug Fix: 支払済み判定に必要（壊さない）
      "paid_at",
      "reset_sent_at",
    ]);

    values = sheet.getDataRange().getValues();
    header = values[0];

    const idx = indexMap_(header);
    const rows = values.slice(1);

    let targetRowIndex = 0;
    for (let i = 0; i < rows.length; i++) {
      const rowIndex = i + 2;
      if (str_(rows[i][idx["apply_id"]]) === applyId) {
        targetRowIndex = rowIndex;
        break;
      }
    }

    // 見つからない場合は互換で新規作成（既存設計を維持）
    if (!targetRowIndex) {
      const row = new Array(header.length).fill("");
      row[idx["created_at"]] = new Date();
      row[idx["plan"]] = plan;
      row[idx["email"]] = email;
      row[idx["name"]] = name;
      row[idx["name_kana"]] = nameKana;
      row[idx["ref_name"]] = str_(body.refName);
      row[idx["ref_id"]] = str_(body.refId);
      row[idx["discord_id"]] = str_(body.discordId);
      row[idx["age_band"]] = str_(body.ageBand);
      row[idx["prefecture"]] = str_(body.prefecture);
      row[idx["city"]] = str_(body.city);
      row[idx["job"]] = str_(body.job);

      const pref = str_(body.prefecture);
      const region = str_(body.region);
      row[idx["region"]] = region || pref;

      // ✅ 今回追加：入力された紹介コードを保存（壊さない）
      row[idx["ref_code"]] = str_(body.refCode);

      // ✅ 期待金額（自動承認用）
      const exp = planToExpectedPaid_(plan);
      if (exp > 0) {
        row[idx["expected_paid"]] = exp;
      } else {
        row[idx["expected_paid"]] = "";
      }

      row[idx["status"]] = "pending";
      row[idx["apply_id"]] = applyId;

      sheet.appendRow(row);
      return json_({ ok: true, created_new: true });
    }

    // 既存行を更新（既存仕様を維持）
    sheet.getRange(targetRowIndex, idx["plan"] + 1).setValue(plan);
    sheet.getRange(targetRowIndex, idx["email"] + 1).setValue(email);
    sheet.getRange(targetRowIndex, idx["name"] + 1).setValue(name);
    sheet.getRange(targetRowIndex, idx["name_kana"] + 1).setValue(nameKana);
    sheet.getRange(targetRowIndex, idx["ref_name"] + 1).setValue(str_(body.refName));
    sheet.getRange(targetRowIndex, idx["ref_id"] + 1).setValue(str_(body.refId));

    sheet.getRange(targetRowIndex, idx["discord_id"] + 1).setValue(str_(body.discordId));
    sheet.getRange(targetRowIndex, idx["age_band"] + 1).setValue(str_(body.ageBand));
    sheet.getRange(targetRowIndex, idx["prefecture"] + 1).setValue(str_(body.prefecture));
    sheet.getRange(targetRowIndex, idx["city"] + 1).setValue(str_(body.city));
    sheet.getRange(targetRowIndex, idx["job"] + 1).setValue(str_(body.job));

    const currentRegion = sheet.getRange(targetRowIndex, idx["region"] + 1).getValue();
    if (!currentRegion) {
      sheet.getRange(targetRowIndex, idx["region"] + 1).setValue(str_(body.prefecture) || str_(body.region));
    }

    // ✅ 今回追加：入力された紹介コードを保存（壊さない）
    sheet.getRange(targetRowIndex, idx["ref_code"] + 1).setValue(str_(body.refCode));

    // ✅ 期待金額（自動承認用）plan変更があり得るので空なら埋める（壊さない）
    const curExpected = sheet.getRange(targetRowIndex, idx["expected_paid"] + 1).getValue();
    if (!curExpected) {
      const exp = planToExpectedPaid_(plan);
      if (exp > 0) {
        sheet.getRange(targetRowIndex, idx["expected_paid"] + 1).setValue(exp);
      }
    }

    // status は paid / approved を上書きしない（既存仕様維持）
    const curStatus = str_(sheet.getRange(targetRowIndex, idx["status"] + 1).getValue());
    if (curStatus !== "paid" && curStatus !== "approved") {
      sheet.getRange(targetRowIndex, idx["status"] + 1).setValue("pending");
    }

    // ✅ Bug Fix: IPNがフォーム送信前に届いてemail空でpending_errorになった場合の救済
    // 支払済み（paid_at あり）+ email が今回セットされた + メール未送信 + 未承認 → 自動承認をトリガー
    try {
      const emailNow = str_(sheet.getRange(targetRowIndex, idx["email"] + 1).getValue());
      const paidAt = idx["paid_at"] !== undefined ? sheet.getRange(targetRowIndex, idx["paid_at"] + 1).getValue() : "";
      const sentAt = idx["reset_sent_at"] !== undefined ? sheet.getRange(targetRowIndex, idx["reset_sent_at"] + 1).getValue() : "";
      const latestStatus = str_(sheet.getRange(targetRowIndex, idx["status"] + 1).getValue());
      if (emailNow && paidAt && !sentAt && latestStatus !== "approved") {
        approveRowCore_(sheet, header, idx, targetRowIndex, "apply_late_trigger");
      }
    } catch (e) {
      // 失敗しても apply 自体は成功として返す（壊さない）
    }

    return json_({ ok: true, updated: true });
  }

  // =========================================================
  // admin_list（管理：一覧）
  // =========================================================
  if (action === "admin_list") {
    if (str_(body.adminKey) !== ADMIN_SECRET) {
      return json_({ ok: false, error: "admin_unauthorized" });
    }

    let values = sheet.getDataRange().getValues();
    let header = values[0];

    // ✅ 参照列保証（壊さない）
    ensureCols_(sheet, header, [
      "created_at",
      "plan",
      "email",
      "name",
      "status",
      "apply_id",
      "login_id",

      // ✅ 自動承認（今回追加：壊さない）
      "expected_paid",
      "auto_approved_at",
      "auto_approve_reason",
      "actually_paid",

      // ✅ NOWPayments金額・通貨（今回追加：壊さない）
      "pay_amount",
      "pay_currency",
      "price_amount",
      "price_currency",

      "payment_status",
      "order_id",
      "invoice_id",

      // ✅ BP/EP付与（今回追加：壊さない）
      "bp_balance",
      "ep_balance",
      "bp_granted_at",
      "bp_grant_plan",
      "bp_grant_amount",
      "ep_grant_amount",

      // ✅ 紹介配当（今回追加：壊さない）
      "ref_share_pct",
      "ref_bonus_granted_at",
      "ref_bonus_amount",

      // ✅ 紹介者情報（ツリー表示用）
      "referrer_login_id",
      "referrer_2_login_id",
      "referrer_3_login_id",
      "referrer_4_login_id",
      "referrer_5_login_id",
      "ref_path",
      "affiliate_granted_at",
      "my_ref_code",
    ]);

    values = sheet.getDataRange().getValues();
    header = values[0];

    if (!values || values.length < 2) return json_({ ok: true, items: [] });

    const rows = values.slice(1);
    const idx = indexMap_(header);

    const items = rows.map((r, i) => ({
      rowIndex: i + 2,
      created_at: r[idx["created_at"]],
      plan: r[idx["plan"]],
      email: r[idx["email"]],
      name: r[idx["name"]],
      status: r[idx["status"]],
      apply_id: r[idx["apply_id"]],
      login_id: r[idx["login_id"]],

      // ✅ 追加（壊さない）
      expected_paid: r[idx["expected_paid"]],
      auto_approved_at: r[idx["auto_approved_at"]],
      auto_approve_reason: r[idx["auto_approve_reason"]],
      actually_paid: r[idx["actually_paid"]],

      // ✅ NOWPayments金額・通貨（今回追加：壊さない）
      pay_amount: r[idx["pay_amount"]],
      pay_currency: r[idx["pay_currency"]],
      price_amount: r[idx["price_amount"]],
      price_currency: r[idx["price_currency"]],

      payment_status: r[idx["payment_status"]],
      order_id: r[idx["order_id"]],
      invoice_id: r[idx["invoice_id"]],

      // ✅ BP/EP付与（今回追加：壊さない）
      bp_balance: r[idx["bp_balance"]],
      ep_balance: r[idx["ep_balance"]],
      bp_granted_at: r[idx["bp_granted_at"]],
      bp_grant_plan: r[idx["bp_grant_plan"]],
      bp_grant_amount: r[idx["bp_grant_amount"]],
      ep_grant_amount: r[idx["ep_grant_amount"]],

      // ✅ 紹介配当（今回追加：壊さない）
      ref_share_pct: r[idx["ref_share_pct"]],
      ref_bonus_granted_at: r[idx["ref_bonus_granted_at"]],
      ref_bonus_amount: r[idx["ref_bonus_amount"]],

      // ✅ 紹介者情報（ツリー表示用）
      referrer_login_id:   r[idx["referrer_login_id"]]   ?? "",
      referrer_2_login_id: r[idx["referrer_2_login_id"]] ?? "",
      referrer_3_login_id: r[idx["referrer_3_login_id"]] ?? "",
      referrer_4_login_id: r[idx["referrer_4_login_id"]] ?? "",
      referrer_5_login_id: r[idx["referrer_5_login_id"]] ?? "",
      ref_path:            r[idx["ref_path"]]            ?? "",
      affiliate_granted_at: r[idx["affiliate_granted_at"]] ?? "",
      my_ref_code:         r[idx["my_ref_code"]]         ?? "",
    }));

    return json_({ ok: true, items: items });
  }

  // =========================================================
  // admin_approve（承認 + RESET TOKEN発行 + メール送信）
  // ※ 旧仕様：ID/PW発行（tempPassword）は削除せず補助関数も残すが、ここでは使わない
  // ✅ 追加：紹介コード発行 + 紹介紐づけ(最大3段) + ref_events記録
  // =========================================================
  if (action === "admin_approve") {
    if (str_(body.adminKey) !== ADMIN_SECRET) {
      return json_({ ok: false, error: "admin_unauthorized" });
    }

    const rowIndex = Number(body.rowIndex || 0);
    if (!rowIndex || rowIndex < 2) return json_({ ok: false, error: "bad_row" });

    let values = sheet.getDataRange().getValues();
    let header = values[0];

    // ✅ 必要列保証（壊さない）
    ensureCols_(sheet, header, [
      "email",
      "status",
      "login_id",
      "pw_hash",
      "pw_updated_at",
      "reset_token",
      "reset_expires",
      "reset_used_at",
      "reset_sent_at",

      // ✅ 紹介コード（今回追加：壊さない）
      "my_ref_code",
      "ref_code",
      "referrer_login_id",
      "referrer_2_login_id",
      "referrer_3_login_id",
      "ref_path",

      // ✅ 自動承認（今回追加：壊さない）
      "expected_paid",
      "auto_approved_at",
      "auto_approve_reason",

      // ✅ BP/EP付与（今回追加：壊さない）
      "bp_balance",
      "ep_balance",
      "bp_granted_at",
      "bp_grant_plan",
      "bp_grant_amount",
      "ep_grant_amount",

      // ✅ 紹介配当（今回追加：壊さない）
      "ref_share_pct",
      "ref_bonus_granted_at",
      "ref_bonus_amount",
    ]);

    values = sheet.getDataRange().getValues();
    header = values[0];
    const idx = indexMap_(header);

    // ✅ 共通の承認コアを実行（壊さない）
    const res = approveRowCore_(sheet, header, idx, rowIndex, "admin_approve");

    // ✅ admin_approve は従来の返り値も維持したいので、それを含めて返す（壊さない）
    if (res && res.ok) {
      return json_({
        ok: true,
        loginId: res.loginId,
        resetSent: res.resetSent,
        myRefCode: res.myRefCode,
        refBound: res.refBound,
        bpGranted: res.bpGranted,
        bpAdded: res.bpAdded,
        epAdded: res.epAdded,
        refBonusGranted: res.refBonusGranted,
        refBonusAmount: res.refBonusAmount,
      });
    } else {
      return json_({ ok: false, error: res && res.error ? res.error : "approve_failed" });
    }
  }

  // =========================================================
  // =========================================================
  // admin_dashboard（管理ダッシュボード集計）
  // - adminKey 認証必須（GAS_ADMIN_KEY）
  // - 会員サマリー / ガチャ / ステーキング / RADIO 統計を返す
  // =========================================================
  if (action === "admin_dashboard") {
    if (str_(body.adminKey) !== ADMIN_SECRET) {
      return json_({ ok: false, error: "admin_unauthorized" });
    }

    // applies シート集計
    const values = sheet.getDataRange().getValues();
    const header = values[0];
    const idx    = indexMap_(header);
    const rows   = values.slice(1);

    let totalMembers  = 0;
    let pendingCount  = 0;
    let totalBpIssued = 0;
    let totalEpIssued = 0;
    const members = [];

    for (let i = 0; i < rows.length; i++) {
      const r      = rows[i];
      const status = str_(r[idx["status"]]);
      if (status === "approved") {
        totalMembers++;
        totalBpIssued += Number(r[idx["bp_balance"]] || 0);
        totalEpIssued += Number(r[idx["ep_balance"]] || 0);
        members.push({
          login_id:          str_(r[idx["login_id"]]),
          name:              str_(r[idx["name"]]),
          email:             str_(r[idx["email"]]),
          plan:              str_(r[idx["plan"]]),
          status:            status,
          created_at:        r[idx["created_at"]] ? new Date(r[idx["created_at"]]).toISOString() : "",
          bp_balance:        Number(r[idx["bp_balance"]] || 0),
          ep_balance:        Number(r[idx["ep_balance"]] || 0),
          login_streak:      Number(r[idx["login_streak"]] || 0),
          total_login_count: Number(r[idx["total_login_count"]] || 0),
          subscription_plan: str_(r[idx["subscription_plan"]]),
          last_login_at:     r[idx["last_login_at"]] ? new Date(r[idx["last_login_at"]]).toISOString() : "",
        });
      } else if (status === "pending" || status === "paid" || status === "pending_payment") {
        pendingCount++;
      }
    }

    // staking シート集計
    const stakingSheet = getOrCreateStakingSheet_();
    const sValues = stakingSheet.getDataRange().getValues();
    const sHeader = sValues[0];
    const sIdx    = indexMap_(sHeader);
    const sRows   = sValues.slice(1);
    let activeCount    = 0;
    let totalStakedBp  = 0;
    let claimableCount = 0;
    const nowMs = Date.now();
    for (let i = 0; i < sRows.length; i++) {
      const r      = sRows[i];
      const status = str_(r[sIdx["status"]]);
      if (status === "active") {
        activeCount++;
        totalStakedBp += Number(r[sIdx["staked_bp"]] || 0);
        const expiresAt = r[sIdx["expires_at"]];
        if (expiresAt && new Date(expiresAt).getTime() < nowMs) claimableCount++;
      }
    }

    // wallet_ledger シート集計（ガチャ）
    const ss  = SpreadsheetApp.getActiveSpreadsheet();
    const led = getOrCreateSheetByName_(ss, "wallet_ledger", ["ts","kind","login_id","email","amount","memo"]);
    const lValues = led.getDataRange().getValues();
    const lHeader = lValues[0];
    const lIdx    = indexMap_(lHeader);
    const lRows   = lValues.slice(1);
    let totalSpins   = 0;
    let totalCostBp  = 0;
    let totalPrizeBp = 0;
    for (let i = 0; i < lRows.length; i++) {
      const kind = str_(lRows[i][lIdx["kind"]]);
      const amt  = Number(lRows[i][lIdx["amount"]] || 0);
      if (kind === "gacha_cost")  { totalSpins++; totalCostBp  += Math.abs(amt); }
      if (kind === "gacha_prize") { totalPrizeBp += amt; }
    }

    // radio_missions シート集計
    const mSheet  = getOrCreateRadioMissionsSheet_();
    const mValues = mSheet.getDataRange().getValues();
    const mHeader = mValues[0];
    const mIdx    = indexMap_(mHeader);
    const mRows   = mValues.slice(1);
    let totalSubmissions = 0;
    let totalEpGranted   = 0;
    for (let i = 0; i < mRows.length; i++) {
      if (str_(mRows[i][mIdx["status"]]) === "approved") {
        totalSubmissions++;
        totalEpGranted += Number(mRows[i][mIdx["ep_granted"]] || 0);
      }
    }

    return json_({
      ok: true,
      summary: {
        total_members:   totalMembers,
        pending_count:   pendingCount,
        total_bp_issued: totalBpIssued,
        total_ep_issued: totalEpIssued,
      },
      members: members,
      staking_summary: {
        active_count:    activeCount,
        total_staked_bp: totalStakedBp,
        claimable_count: claimableCount,
      },
      gacha_summary: {
        total_spins:    totalSpins,
        total_cost_bp:  totalCostBp,
        total_prize_bp: totalPrizeBp,
      },
      radio_summary: {
        total_submissions: totalSubmissions,
        total_ep_granted:  totalEpGranted,
      },
    });
  }

  // =========================================================
  // admin_get_members（会員一覧ページネーション）
  // - adminKey 認証必須（GAS_ADMIN_KEY）
  // - page / pageSize で approved 会員を返す
  // =========================================================
  if (action === "admin_get_members") {
    if (str_(body.adminKey) !== ADMIN_SECRET) {
      return json_({ ok: false, error: "admin_unauthorized" });
    }

    const page     = Math.max(0, Number(body.page     || 0));

    // ── Music Boost マップ構築（userId → {plan_id, expires_at}）──
    var boostMap = {};
    try {
      var bSS    = SpreadsheetApp.getActiveSpreadsheet();
      var bSheet = bSS.getSheetByName("music_boost");
      if (bSheet) {
        var bData = bSheet.getDataRange().getValues();
        var bHdr  = bData[0];
        var bIdx  = {};
        bHdr.forEach(function(h, i) { bIdx[h] = i; });
        for (var bi = 1; bi < bData.length; bi++) {
          if (String(bData[bi][bIdx["status"]]) === "active") {
            boostMap[String(bData[bi][bIdx["user_id"]])] = {
              plan_id:    String(bData[bi][bIdx["plan_id"]]),
              expires_at: String(bData[bi][bIdx["expires_at"]]),
            };
          }
        }
      }
    } catch (e) { /* シートなければ空マップのまま */ }
    // ─────────────────────────────────────────────────────────

    const pageSize = Math.min(100, Math.max(1, Number(body.pageSize || 20)));

    const values = sheet.getDataRange().getValues();
    const header = values[0];
    const idx    = indexMap_(header);
    const rows   = values.slice(1);

    const approved = [];
    for (let i = 0; i < rows.length; i++) {
      const r = rows[i];
      if (str_(r[idx["status"]]) !== "approved") continue;
      approved.push({
        login_id:          str_(r[idx["login_id"]]),
        name:              str_(r[idx["name"]]),
        email:             str_(r[idx["email"]]),
        plan:              str_(r[idx["plan"]]),
        status:            "approved",
        created_at:        r[idx["created_at"]] ? new Date(r[idx["created_at"]]).toISOString() : "",
        bp_balance:        Number(r[idx["bp_balance"]] || 0),
        ep_balance:        Number(r[idx["ep_balance"]] || 0),
        login_streak:      Number(r[idx["login_streak"]] || 0),
        total_login_count: Number(r[idx["total_login_count"]] || 0),
        subscription_plan: str_(r[idx["subscription_plan"]]),
        last_login_at:     r[idx["last_login_at"]] ? new Date(r[idx["last_login_at"]]).toISOString() : "",
        music_boost_plan:       boostMap[str_(r[idx["login_id"]])] ? boostMap[str_(r[idx["login_id"]])].plan_id    : null,
        music_boost_expires_at: boostMap[str_(r[idx["login_id"]])] ? boostMap[str_(r[idx["login_id"]])].expires_at : null,
        music_boost_artist:     str_(r[idx["music_boost_artist"]] || ""),
        music_boost_album:      str_(r[idx["music_boost_album"]]  || ""),
      });
    }

    // ── サーバーサイドソート ──────────────────────────────────
    var ALLOWED_SORT_KEYS = ["created_at", "ep_balance", "bp_balance",
                             "login_streak", "total_login_count", "last_login_at"];
    var sortKey   = ALLOWED_SORT_KEYS.indexOf(str_(body.sortKey)) !== -1
                    ? str_(body.sortKey) : "created_at";
    var sortOrder = str_(body.sortOrder) === "asc" ? "asc" : "desc";

    approved.sort(function(a, b) {
      var av = a[sortKey];
      var bv = b[sortKey];
      // 数値列は数値比較
      if (typeof av === "number" && typeof bv === "number") {
        return sortOrder === "asc" ? av - bv : bv - av;
      }
      // 文字列（日時含む）は文字列比較
      var as = String(av || "");
      var bs = String(bv || "");
      if (sortOrder === "asc") return as < bs ? -1 : as > bs ? 1 : 0;
      else                     return bs < as ? -1 : bs > as ? 1 : 0;
    });
    // ─────────────────────────────────────────────────────────

    const start   = page * pageSize;
    const sliced  = approved.slice(start, start + pageSize);

    return json_({
      ok:       true,
      members:  sliced,
      total:    approved.length,
      page:     page,
      pageSize: pageSize,
    });
  }

  // ✅ ref_tree_build（管理：ツリー表示専用シート ref_tree を再生成）
  // - データの正本は applies（壊さない）
  // - 表示用に ref_tree を全消し→再生成
  // ✅ 改善：getDataRange() を安全化（巨大DataRangeで落ちるサーバーエラー回避）
  // ✅ 改善：out 完成後に clear する（途中失敗で ref_tree が空になる事故を防ぐ）
  // ✅ 改善：setValues を分割（保険）
  // =========================================================
  if (action === "ref_tree_build") {
    if (str_(body.adminKey) !== ADMIN_SECRET) {
      return json_({ ok: false, error: "admin_unauthorized" });
    }

    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const applies = getOrCreateSheet_();

    // ref_tree / ref_events は無ければ作る（壊さない）
    const treeSheet = getOrCreateSheetByName_(ss, "ref_tree", [
      "L1",
      "L1_direct_count",
      "L2",
      "L2_direct_count",
      "L3",
      "L3_status",
      "L3_email",
      "L3_created_at",
      "L1_share_pct",
      "L1_bonus_total",
      "L2_share_pct",
      "L2_bonus_total",
    ]);

    // appliesに必要列保証（壊さない）
    let values = getValuesSafe_(applies);
    let header = values[0];

    ensureCols_(applies, header, [
      "created_at",
      "email",
      "status",
      "login_id",
      "my_ref_code",
      "ref_code",
      "referrer_login_id",
      "referrer_2_login_id",
      "referrer_3_login_id",
      "ref_path",
      "expected_paid",
      "plan",

      // ✅ 紹介配当（今回追加：壊さない）
      "ref_share_pct",
      "ref_bonus_granted_at",
      "ref_bonus_amount",
    ]);

    values = getValuesSafe_(applies);
    header = values[0];
    const idx = indexMap_(header);
    const rows = values.slice(1);

    // maps
    const byLogin = {};
    const children = {};

    for (let i = 0; i < rows.length; i++) {
      const r = rows[i];
      const loginId = str_(r[idx["login_id"]]);
      if (!loginId) continue;

      byLogin[loginId] = {
        login_id: loginId,
        email: str_(r[idx["email"]]),
        status: str_(r[idx["status"]]),
        created_at: r[idx["created_at"]],
        ref1: str_(r[idx["referrer_login_id"]]),
        share_pct: parseMoneyLike_(r[idx["ref_share_pct"]]),
      };
    }

    for (const k in byLogin) {
      children[k] = [];
    }

    for (const k2 in byLogin) {
      const node = byLogin[k2];
      const p = str_(node.ref1);
      if (p && children[p]) {
        children[p].push(node.login_id);
      }
    }

    // direct count
    const directCount = {};
    for (const k3 in children) {
      directCount[k3] = (children[k3] || []).length;
    }

    // ✅ 紹介配当の合計を集計（表示用）
    // - 1段のみ：child の referrer_login_id に対して referrer の ref_share_pct を適用
    // - 金額基準：plan額（expected_paid）で計算
    const bonusTotalByLogin = {};
    for (const kx in byLogin) bonusTotalByLogin[kx] = 0;

    for (let ii = 0; ii < rows.length; ii++) {
      const r = rows[ii];

      const childStatus = str_(r[idx["status"]]);
      const childRef1 = str_(r[idx["referrer_login_id"]]);
      if (!childRef1) continue;

      // approved（or paid）以外は対象外（表示上の事故を防ぐ）
      if (childStatus !== "approved" && childStatus !== "paid") continue;

      // expected_paid が空なら plan から埋める（表示用途：壊さない）
      let expected = parseMoneyLike_(r[idx["expected_paid"]]);
      if (!expected || !Number.isFinite(expected) || expected <= 0) {
        const p2 = str_(r[idx["plan"]]);
        const exp2 = planToExpectedPaid_(p2);
        if (exp2 > 0) expected = exp2;
      }
      if (!expected || !Number.isFinite(expected) || expected <= 0) continue;

      const refNode = byLogin[childRef1];
      if (!refNode) continue;

      const pct = Number.isFinite(refNode.share_pct) ? refNode.share_pct : 0;
      const pctOk = pct === 20 || pct === 40;
      if (!pctOk) continue;

      const bonus = expected * (pct / 100);
      if (!bonusTotalByLogin[childRef1]) bonusTotalByLogin[childRef1] = 0;
      bonusTotalByLogin[childRef1] += bonus;
    }

    // L1 roots = 直紹介が1人以上いる人
    const l1s = Object.keys(children).filter((k4) => (children[k4] || []).length > 0);

    // 並び順：直紹介が多い順→login_id
    l1s.sort((a, b) => {
      const da = directCount[a] || 0;
      const db = directCount[b] || 0;
      if (db !== da) return db - da;
      return a < b ? -1 : a > b ? 1 : 0;
    });

    // rows out
    const out = [];

    function label_(loginId, prefix) {
      const email = byLogin[loginId] ? byLogin[loginId].email : "";
      const base = loginId + (email ? " (" + email + ")" : "");
      return (prefix || "") + base;
    }

    function pct_(loginId) {
      const n = byLogin[loginId] ? Number(byLogin[loginId].share_pct || 0) : 0;
      if (n === 20 || n === 40) return n;
      return "";
    }

    function bonus_(loginId) {
      const n = bonusTotalByLogin[loginId] ? Number(bonusTotalByLogin[loginId] || 0) : 0;
      if (!Number.isFinite(n) || n <= 0) return 0;
      return n;
    }

    for (let i1 = 0; i1 < l1s.length; i1++) {
      const l1 = l1s[i1];
      const l1Kids = children[l1] || [];

      // L2並び：直紹介が多い順→login_id
      l1Kids.sort((a, b) => {
        const da = directCount[a] || 0;
        const db = directCount[b] || 0;
        if (db !== da) return db - da;
        return a < b ? -1 : a > b ? 1 : 0;
      });

      for (let i2 = 0; i2 < l1Kids.length; i2++) {
        const l2 = l1Kids[i2];
        const l2Kids = children[l2] || [];

        // L3並び：login_id
        l2Kids.sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));

        if (l2Kids.length === 0) {
          // 3段目がいない場合も行を出す（ツリーに見える）
          out.push([
            label_(l1, ""),
            directCount[l1] || 0,
            label_(l2, "  └ "),
            directCount[l2] || 0,
            "",
            "",
            "",
            "",
            pct_(l1),
            bonus_(l1),
            pct_(l2),
            bonus_(l2),
          ]);
        } else {
          for (let i3 = 0; i3 < l2Kids.length; i3++) {
            const l3 = l2Kids[i3];
            const node3 = byLogin[l3] || {};
            out.push([
              label_(l1, ""),
              directCount[l1] || 0,
              label_(l2, "  └ "),
              directCount[l2] || 0,
              label_(l3, "      └ "),
              str_(node3.status),
              str_(node3.email),
              node3.created_at || "",
              pct_(l1),
              bonus_(l1),
              pct_(l2),
              bonus_(l2),
            ]);
          }
        }
      }

      // L1ごとに空行（見た目がツリーになる）
      out.push(["", "", "", "", "", "", "", "", "", "", "", ""]);
    }

    // ✅ out が作れた後に ref_tree を全消し→再生成（途中エラーで空になるのを防ぐ）
    try {
      const lr = treeSheet.getLastRow();
      const lc = treeSheet.getLastColumn();
      if (lr && lc) {
        treeSheet.getRange(1, 1, lr, lc).clearContent();
      } else {
        treeSheet.clearContents();
      }
    } catch (e) {
      treeSheet.clearContents();
    }

    treeSheet.appendRow([
      "L1",
      "L1_direct_count",
      "L2",
      "L2_direct_count",
      "L3",
      "L3_status",
      "L3_email",
      "L3_created_at",
      "L1_share_pct",
      "L1_bonus_total",
      "L2_share_pct",
      "L2_bonus_total",
    ]);

    // 書き込み（まとめて）※大きい場合に備えて分割（保険）
    if (out.length > 0) {
      const CHUNK = 5000;
      for (let i = 0; i < out.length; i += CHUNK) {
        const part = out.slice(i, i + CHUNK);
        treeSheet.getRange(2 + i, 1, part.length, 12).setValues(part);
      }
    }

    // 見やすく：フィルタと列幅（壊さない）
    try {
      treeSheet.setFrozenRows(1);
      treeSheet.autoResizeColumns(1, 12);
    } catch (e) {}

    return json_({ ok: true, l1_count: l1s.length, rows: out.length });
  }

  // =========================================================
  // ✅ wallet_ledger_all（管理：wallet_ledger シート全行を返す）
  // =========================================================
  if (action === "wallet_ledger_all") {
    if (str_(body.adminKey) !== ADMIN_SECRET) {
      return json_({ ok: false, error: "admin_unauthorized" });
    }

    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const led = ss.getSheetByName("wallet_ledger");
    if (!led) return json_({ ok: true, items: [] });

    const ledValues = getValuesSafe_(led);
    if (ledValues.length < 2) return json_({ ok: true, items: [] });

    const ledHeader = ledValues[0];
    const ledIdx = indexMap_(ledHeader);
    const items = ledValues.slice(1).map(function(r) {
      return {
        ts:       str_(r[ledIdx["ts"]]),
        kind:     str_(r[ledIdx["kind"]]),
        login_id: str_(r[ledIdx["login_id"]]),
        email:    str_(r[ledIdx["email"]]),
        amount:   num_(r[ledIdx["amount"]]),
        memo:     str_(r[ledIdx["memo"]]),
      };
    }).filter(function(it) { return it.login_id || it.kind; });

    return json_({ ok: true, items: items });
  }

  // =========================================================
  // ✅ ref_reassign（管理：紹介者変更 + referrer_2〜5 再計算）
  // =========================================================
  if (action === "ref_reassign") {
    if (str_(body.adminKey) !== ADMIN_SECRET) {
      return json_({ ok: false, error: "admin_unauthorized" });
    }

    const targetLoginId      = str_(body.targetLoginId);
    const newReferrerLoginId = str_(body.newReferrerLoginId);
    const note               = str_(body.note) || "admin_finance_drag";

    if (!targetLoginId) {
      return json_({ ok: false, error: "missing_targetLoginId" });
    }
    if (newReferrerLoginId && targetLoginId === newReferrerLoginId) {
      return json_({ ok: false, error: "self_referral" });
    }

    const rrSheet  = getOrCreateSheet_();
    const rrValues = getValuesSafe_(rrSheet);
    const rrHeader = rrValues[0];
    const rrIdx    = indexMap_(rrHeader);

    let targetRowIndex = -1;
    for (let ri = 1; ri < rrValues.length; ri++) {
      if (str_(rrValues[ri][rrIdx["login_id"]]) === targetLoginId) {
        targetRowIndex = ri + 1;
        break;
      }
    }
    if (targetRowIndex === -1) {
      return json_({ ok: false, error: "target_not_found" });
    }

    if (newReferrerLoginId) {
      const rrVisited = new Set();
      let rrCur = newReferrerLoginId;
      while (rrCur && !rrVisited.has(rrCur)) {
        if (rrCur === targetLoginId) {
          return json_({ ok: false, error: "circular_reference" });
        }
        rrVisited.add(rrCur);
        let rrNext = null;
        for (let ri = 1; ri < rrValues.length; ri++) {
          if (str_(rrValues[ri][rrIdx["login_id"]]) === rrCur) {
            rrNext = str_(rrValues[ri][rrIdx["referrer_login_id"]]) || null;
            break;
          }
        }
        rrCur = rrNext;
      }
    }

    const newChain = [];
    if (newReferrerLoginId) {
      newChain.push(newReferrerLoginId);
      const chainVisited = new Set([newReferrerLoginId]);
      let chainCur = newReferrerLoginId;
      while (newChain.length < 5) {
        let chainNext = null;
        for (let ri = 1; ri < rrValues.length; ri++) {
          if (str_(rrValues[ri][rrIdx["login_id"]]) === chainCur) {
            chainNext = str_(rrValues[ri][rrIdx["referrer_login_id"]]) || null;
            break;
          }
        }
        if (!chainNext || chainVisited.has(chainNext)) break;
        chainVisited.add(chainNext);
        newChain.push(chainNext);
        chainCur = chainNext;
      }
    }

    const newRefPath  = [targetLoginId].concat(newChain).join(" > ");
    const writeCols   = ["referrer_login_id","referrer_2_login_id","referrer_3_login_id","referrer_4_login_id","referrer_5_login_id","ref_path"];
    const writeVals   = [newChain[0]||"", newChain[1]||"", newChain[2]||"", newChain[3]||"", newChain[4]||"", newRefPath];
    for (let ci = 0; ci < writeCols.length; ci++) {
      if (rrIdx[writeCols[ci]] !== undefined) {
        rrSheet.getRange(targetRowIndex, rrIdx[writeCols[ci]] + 1).setValue(writeVals[ci]);
      }
    }

    appendRefEvent_({
      new_login_id:  targetLoginId,
      new_email:     "",
      used_ref_code: "",
      ref1_login_id: newChain[0] || "",
      ref2_login_id: newChain[1] || "",
      ref3_login_id: newChain[2] || "",
      note:          note,
    });

    return json_({ ok: true, targetLoginId: targetLoginId, newReferrerLoginId: newReferrerLoginId });
  }

  // =========================================================
  // ✅ ref_backfill_from_refcode（管理：ref_codeから紹介者を一括バックフィル）
  // 条件: ref_code が入っていて referrer_login_id が空の行のみ対象
  // 既存の紹介者設定は一切上書きしない
  // =========================================================
  if (action === "ref_backfill_from_refcode") {
    if (str_(body.adminKey) !== ADMIN_SECRET) {
      return json_({ ok: false, error: "admin_unauthorized" });
    }

    const bfSheet  = getOrCreateSheet_();
    const bfValues = getValuesSafe_(bfSheet);
    const bfHeader = bfValues[0];
    const bfIdx    = indexMap_(bfHeader);

    const needCols = ["ref_code", "referrer_login_id", "my_ref_code", "login_id", "ref_path"];
    for (let i = 0; i < needCols.length; i++) {
      if (bfIdx[needCols[i]] === undefined) {
        return json_({ ok: false, error: "missing_column_" + needCols[i] });
      }
    }

    // my_ref_code → { login_id, ref2〜ref5 } のルックアップマップを事前構築
    const myRefMap = {};
    for (let ri = 1; ri < bfValues.length; ri++) {
      const r   = bfValues[ri];
      const mrc = str_(r[bfIdx["my_ref_code"]]);
      if (mrc) {
        myRefMap[mrc] = {
          login_id: str_(r[bfIdx["login_id"]]),
          ref2: bfIdx["referrer_login_id"]   !== undefined ? str_(r[bfIdx["referrer_login_id"]])   : "",
          ref3: bfIdx["referrer_2_login_id"] !== undefined ? str_(r[bfIdx["referrer_2_login_id"]]) : "",
          ref4: bfIdx["referrer_3_login_id"] !== undefined ? str_(r[bfIdx["referrer_3_login_id"]]) : "",
          ref5: bfIdx["referrer_4_login_id"] !== undefined ? str_(r[bfIdx["referrer_4_login_id"]]) : "",
        };
      }
    }

    let updated   = 0;
    let skipped   = 0;
    let unmatched = 0;

    for (let ri = 1; ri < bfValues.length; ri++) {
      const r              = bfValues[ri];
      const refCode        = str_(r[bfIdx["ref_code"]]);
      const existingRef1   = str_(r[bfIdx["referrer_login_id"]]);

      if (!refCode) continue;

      if (existingRef1) {
        skipped++;
        continue;
      }

      const referrer = myRefMap[refCode];
      if (!referrer || !referrer.login_id) {
        unmatched++;
        continue;
      }

      const ref1 = referrer.login_id;
      const ref2 = referrer.ref2 || "";
      const ref3 = referrer.ref3 || "";
      const ref4 = referrer.ref4 || "";
      const ref5 = referrer.ref5 || "";
      const path =
        ref1 +
        (ref2 ? " > " + ref2 : "") +
        (ref3 ? " > " + ref3 : "") +
        (ref4 ? " > " + ref4 : "") +
        (ref5 ? " > " + ref5 : "");

      const rowIndex = ri + 1;
      bfSheet.getRange(rowIndex, bfIdx["referrer_login_id"] + 1).setValue(ref1);
      if (bfIdx["referrer_2_login_id"] !== undefined) {
        bfSheet.getRange(rowIndex, bfIdx["referrer_2_login_id"] + 1).setValue(ref2);
      }
      if (bfIdx["referrer_3_login_id"] !== undefined) {
        bfSheet.getRange(rowIndex, bfIdx["referrer_3_login_id"] + 1).setValue(ref3);
      }
      if (bfIdx["referrer_4_login_id"] !== undefined) {
        bfSheet.getRange(rowIndex, bfIdx["referrer_4_login_id"] + 1).setValue(ref4);
      }
      if (bfIdx["referrer_5_login_id"] !== undefined) {
        bfSheet.getRange(rowIndex, bfIdx["referrer_5_login_id"] + 1).setValue(ref5);
      }
      bfSheet.getRange(rowIndex, bfIdx["ref_path"] + 1).setValue(path);

      const loginId = str_(r[bfIdx["login_id"]]);
      const email   = bfIdx["email"] !== undefined ? str_(r[bfIdx["email"]]) : "";
      appendRefEvent_({
        new_login_id:  loginId,
        new_email:     email,
        used_ref_code: refCode,
        ref1_login_id: ref1,
        ref2_login_id: ref2,
        ref3_login_id: ref3,
        note:          "ref_backfill_from_refcode",
      });

      updated++;
    }

    SpreadsheetApp.flush();
    return json_({ ok: true, updated: updated, skipped: skipped, unmatched: unmatched });
  }

  // =========================================================
  // ✅ affiliate_monthly_summary（管理：月次アフィリエイト集計）
  // adminKey + month(YYYY-MM) を受け取り、紹介者別EP集計を返す（読み取り専用）
  // 日付フォールバック: approved_at → auto_approved_at → paid_at
  // =========================================================
  if (action === "affiliate_monthly_summary") {
    if (str_(body.adminKey) !== ADMIN_SECRET) {
      return json_({ ok: false, error: "admin_unauthorized" });
    }

    const monthStr = str_(body.month);
    if (!monthStr || !/^\d{4}-\d{2}$/.test(monthStr)) {
      return json_({ ok: false, error: "invalid_month_format" });
    }

    // 対象月の JST 範囲を UTC Date に変換
    const parts = monthStr.split("-");
    const yyyy  = Number(parts[0]);
    const mm    = Number(parts[1]);
    const startUtc = new Date(Date.UTC(yyyy, mm - 1, 1, -9, 0, 0));  // 月初00:00 JST
    const endUtc   = new Date(Date.UTC(yyyy, mm,     1, -9, 0, 0));  // 翌月初00:00 JST（exclusive）

    const settings  = getSystemSettings_();
    const usdToJpy  = settings.usdToJpy;
    const epPerJpy  = settings.epPerJpy;
    const initRates = settings.rates;           // [10, 5, 2, 2, 1]
    const ccRates   = [5, 2.5, 1, 1, 0.5];     // 内部CC決済レート（Phase 2用）

    const amSheet  = getOrCreateSheet_();
    const amValues = getValuesSafe_(amSheet);
    const amHeader = amValues[0];
    const amIdx    = indexMap_(amHeader);

    const refCols = [
      "referrer_login_id",
      "referrer_2_login_id",
      "referrer_3_login_id",
      "referrer_4_login_id",
      "referrer_5_login_id",
    ];

    // referrer ごとの集計マップ
    const referrerMap = {};

    const ensureReferrer = function(loginId) {
      if (!referrerMap[loginId]) {
        referrerMap[loginId] = {
          login_id: loginId,
          levels: [1,2,3,4,5].map(function(lvl) {
            return {
              level:           lvl,
              initial_usd:     0,
              initial_ep:      0,
              cc_usd:          0,
              cc_ep:           0,
              total_ep:        0,
              initial_sources: [],
              cc_sources:      [],
            };
          }),
        };
      }
      return referrerMap[loginId];
    };

    // --- 初回入金の集計（applies シートを走査）---
    for (let ri = 1; ri < amValues.length; ri++) {
      const r      = amValues[ri];
      const status = str_(r[amIdx["status"]]);
      if (status !== "approved") continue;

      // 日付フォールバック: approved_at → auto_approved_at → paid_at
      let effectiveDate = null;
      const dateCols = ["approved_at", "auto_approved_at", "paid_at"];
      for (let dc = 0; dc < dateCols.length; dc++) {
        const col = dateCols[dc];
        if (amIdx[col] === undefined) continue;
        const raw = r[amIdx[col]];
        if (!raw) continue;
        const d = new Date(raw);
        if (!isNaN(d.getTime())) { effectiveDate = d; break; }
      }
      if (!effectiveDate) continue;
      if (effectiveDate < startUtc || effectiveDate >= endUtc) continue;

      // 決済金額
      let amountUsd = 0;
      if (amIdx["expected_paid"] !== undefined) {
        amountUsd = parseMoneyLike_(r[amIdx["expected_paid"]]);
      }
      if (!amountUsd && amIdx["plan"] !== undefined) {
        amountUsd = planToExpectedPaid_(str_(r[amIdx["plan"]]));
      }
      if (!amountUsd) continue;

      const childLoginId = str_(r[amIdx["login_id"]]);
      const amountJpy    = amountUsd * usdToJpy;

      for (let lvl = 0; lvl < 5; lvl++) {
        const colName    = refCols[lvl];
        if (amIdx[colName] === undefined) continue;
        const refLoginId = str_(r[amIdx[colName]]);
        if (!refLoginId) continue;

        const ratePct  = initRates[lvl];
        const rewardEp = Math.floor(amountJpy * ratePct / 100 * epPerJpy);

        const entry = ensureReferrer(refLoginId);
        entry.levels[lvl].initial_usd += amountUsd;
        entry.levels[lvl].initial_ep  += rewardEp;
        entry.levels[lvl].total_ep    += rewardEp;
        if (childLoginId && entry.levels[lvl].initial_sources.indexOf(childLoginId) === -1) {
          entry.levels[lvl].initial_sources.push(childLoginId);
        }
      }
    }

    // --- Phase 2: CC決済の集計（wallet_ledger の kind="cc_payment"）---
    // ※ Stripe / CC決済実装後にコメントアウトを解除する
    /*
    const wlSheet  = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("wallet_ledger");
    if (wlSheet) {
      const wlValues = getValuesSafe_(wlSheet);
      const wlHeader = wlValues[0];
      const wlIdx    = indexMap_(wlHeader);
      for (let ri = 1; ri < wlValues.length; ri++) {
        const r    = wlValues[ri];
        const kind = str_(r[wlIdx["kind"]]);
        if (kind !== "cc_payment") continue;
        const tsRaw = r[wlIdx["ts"]];
        if (!tsRaw) continue;
        const ts = new Date(tsRaw);
        if (isNaN(ts.getTime())) continue;
        if (ts < startUtc || ts >= endUtc) continue;
        const payerLoginId = str_(r[wlIdx["login_id"]]);
        const amountUsd    = parseMoneyLike_(r[wlIdx["amount"]]);
        if (!amountUsd || !payerLoginId) continue;
        // 支払者の referrer チェーンを applies から引く
        for (let ai = 1; ai < amValues.length; ai++) {
          if (str_(amValues[ai][amIdx["login_id"]]) !== payerLoginId) continue;
          const amountJpy = amountUsd * usdToJpy;
          for (let lvl = 0; lvl < 5; lvl++) {
            const colName    = refCols[lvl];
            if (amIdx[colName] === undefined) continue;
            const refLoginId = str_(amValues[ai][amIdx[colName]]);
            if (!refLoginId) continue;
            const ratePct  = ccRates[lvl];
            const rewardEp = Math.floor(amountJpy * ratePct / 100 * epPerJpy);
            const entry    = ensureReferrer(refLoginId);
            entry.levels[lvl].cc_usd   += amountUsd;
            entry.levels[lvl].cc_ep    += rewardEp;
            entry.levels[lvl].total_ep += rewardEp;
            if (entry.levels[lvl].cc_sources.indexOf(payerLoginId) === -1) {
              entry.levels[lvl].cc_sources.push(payerLoginId);
            }
          }
          break;
        }
      }
    }
    */

    // 集計マップを配列に変換（合計EP降順）
    const amReferrers = Object.keys(referrerMap).map(function(k) {
      const r = referrerMap[k];
      const totInitUsd = r.levels.reduce(function(s,l){ return s + l.initial_usd; }, 0);
      const totInitEp  = r.levels.reduce(function(s,l){ return s + l.initial_ep;  }, 0);
      const totCcUsd   = r.levels.reduce(function(s,l){ return s + l.cc_usd;      }, 0);
      const totCcEp    = r.levels.reduce(function(s,l){ return s + l.cc_ep;       }, 0);
      return Object.assign({}, r, {
        total_initial_usd: totInitUsd,
        total_initial_ep:  totInitEp,
        total_cc_usd:      totCcUsd,
        total_cc_ep:       totCcEp,
        total_ep:          totInitEp + totCcEp,
      });
    }).sort(function(a, b){ return b.total_ep - a.total_ep; });

    const amSummary = {
      total_initial_usd: amReferrers.reduce(function(s,r){ return s + r.total_initial_usd; }, 0),
      total_initial_ep:  amReferrers.reduce(function(s,r){ return s + r.total_initial_ep;  }, 0),
      total_cc_usd:      amReferrers.reduce(function(s,r){ return s + r.total_cc_usd;      }, 0),
      total_cc_ep:       amReferrers.reduce(function(s,r){ return s + r.total_cc_ep;       }, 0),
      total_ep:          amReferrers.reduce(function(s,r){ return s + r.total_ep;           }, 0),
      referrer_count:    amReferrers.length,
    };

    return json_({
      ok:          true,
      month:       monthStr,
      usd_to_jpy:  usdToJpy,
      ep_per_jpy:  epPerJpy,
      referrers:   amReferrers,
      summary:     amSummary,
    });
  }

  // =========================================================
  // ✅ send_test_mail（管理：メール送信テスト）
  // adminKey + to アドレスが必要。デプロイ後のMailApp動作確認用。
  // curl などから: ?action=send_test_mail&key=...&adminKey=...&to=xxx@yyy.com
  // =========================================================
  if (action === "send_test_mail") {
    if (str_(body.adminKey) !== ADMIN_SECRET) {
      return json_({ ok: false, error: "admin_unauthorized" });
    }
    const to = str_(body.to);
    if (!to) {
      return json_({ ok: false, error: "to required" });
    }
    try {
      const quota = MailApp.getRemainingDailyQuota();
      Logger.log("[send_test_mail] quota=" + quota + " to=" + to);
      if (quota <= 0) {
        return json_({ ok: false, error: "quota_exhausted", quota: quota });
      }
      sendResetMail_(to, "TEST_LOGIN_ID", "TEST_TOKEN_" + Date.now());
      return json_({ ok: true, to: to, quota: quota });
    } catch (e) {
      Logger.log("[send_test_mail] FAILED: " + String(e));
      return json_({ ok: false, error: String(e) });
    }
  }

  // =========================================================
  // ✅ get_balance（BP/EP残高取得）
  // - Nextの /api/wallet/balance から叩かれる想定
  // - id は login_id か email を許容（壊さない）
  // - 列は ensureCols_ で保証（壊さない）
  // =========================================================
  if (action === "get_balance") {
    const id = str_(body.id);
    const group_bal = str_(body.group);
    const targetSheet_bal = group_bal === "5000" ? getAppliesSheet5000_() : sheet;

    if (!id) {
      return json_({ ok: false, error: "id required" });
    }

    let values = targetSheet_bal.getDataRange().getValues();
    let header = values[0];

    // ✅ 必要列保証（壊さない）
    ensureCols_(targetSheet_bal, header, ["login_id", "email", "bp_balance", "ep_balance", "plan"]);

    values = targetSheet_bal.getDataRange().getValues();
    header = values[0];

    const idx = indexMap_(header);
    const rows = values.slice(1);

    let hit = null;

    for (let i = 0; i < rows.length; i++) {
      const r = rows[i];
      const rowIndex = i + 2;

      const loginId = str_(r[idx["login_id"]]);
      const email = str_(r[idx["email"]]);

      if (id === loginId || id === email) {
        hit = { r: r, rowIndex: rowIndex };
        break;
      }
    }

    if (!hit) {
      return json_({ ok: false, error: "not_found" });
    }

    const bpRaw   = hit.r[idx["bp_balance"]];
    const epRaw   = hit.r[idx["ep_balance"]];
    const planRaw = hit.r[idx["plan"]];

    const bp = Number(bpRaw || 0);
    const ep = Number(epRaw || 0);

    const BP_CAP_MAP_BAL      = { "34":300, "57":600, "114":1200, "567":6000, "1134":12000 };
    const BP_CAP_MAP_BAL_5000 = { "500":1000, "2000":4000, "3000":8000, "5000":10000 };
    const capMap_bal = group_bal === "5000" ? BP_CAP_MAP_BAL_5000 : BP_CAP_MAP_BAL;
    const bpCap_bal  = capMap_bal[str_(planRaw)] ?? 0;

    return json_({
      ok:     true,
      bp:     Number.isFinite(bp) ? bp : 0,
      ep:     Number.isFinite(ep) ? ep : 0,
      plan:   str_(planRaw),
      bp_cap: bpCap_bal,
    });
  }

  // =========================================================
  // deduct_bp（BP減算：AI機能利用時に呼ぶ）
  // - adminKey 認証必須（GAS_ADMIN_KEY）
  // - loginId でユーザーを特定し bp_balance を減算
  // - wallet_ledger に記録
  // =========================================================
  if (action === "deduct_bp") {
    if (str_(body.adminKey) !== ADMIN_SECRET) {
      return json_({ ok: false, error: "admin_unauthorized" });
    }

    const loginId = str_(body.loginId);
    const amount  = Number(body.amount);

    if (!loginId) return json_({ ok: false, error: "loginId_required" });
    if (!Number.isFinite(amount) || amount <= 0) return json_({ ok: false, error: "invalid_amount" });

    let values = sheet.getDataRange().getValues();
    let header = values[0];

    // ✅ 必要列保証（壊さない）
    ensureCols_(sheet, header, ["login_id", "email", "bp_balance"]);

    values = sheet.getDataRange().getValues();
    header = values[0];

    const idx = indexMap_(header);
    const rows = values.slice(1);

    let hitRowIndex = 0;
    let hitEmail    = "";

    for (let i = 0; i < rows.length; i++) {
      if (str_(rows[i][idx["login_id"]]) === loginId) {
        hitRowIndex = i + 2;
        hitEmail    = str_(rows[i][idx["email"]]);
        break;
      }
    }

    if (!hitRowIndex) return json_({ ok: false, error: "not_found" });

    const currentBp = Number(sheet.getRange(hitRowIndex, idx["bp_balance"] + 1).getValue() || 0);

    if (currentBp < amount) {
      return json_({ ok: false, error: "insufficient_bp", bp_balance: currentBp });
    }

    const newBp = currentBp - amount;
    sheet.getRange(hitRowIndex, idx["bp_balance"] + 1).setValue(newBp);

    appendWalletLedger_({
      kind:     "deduct_bp",
      login_id: loginId,
      email:    hitEmail,
      amount:   -amount,
      memo:     "AI機能利用によるBP消費",
    });

    return json_({ ok: true, bp_balance: newBp });
  }

  // =========================================================
  // deduct_ep（EP減算：narasu代理申請等の有料サービス利用時）
  // - adminKey 認証必須（GAS_ADMIN_KEY）
  // - loginId でユーザーを特定し ep_balance を減算
  // - wallet_ledger に記録
  // =========================================================
  if (action === "deduct_ep") {
    if (str_(body.adminKey) !== ADMIN_SECRET) {
      return json_({ ok: false, error: "admin_unauthorized" });
    }

    const loginId = str_(body.loginId);
    const amount  = Number(body.amount);

    if (!loginId) return json_({ ok: false, error: "loginId_required" });
    if (!Number.isFinite(amount) || amount <= 0) return json_({ ok: false, error: "invalid_amount" });

    let values = sheet.getDataRange().getValues();
    let header = values[0];

    ensureCols_(sheet, header, ["login_id", "email", "ep_balance"]);

    values = sheet.getDataRange().getValues();
    header = values[0];

    const idx = indexMap_(header);
    const rows = values.slice(1);

    let hitRowIndex = 0;
    let hitEmail    = "";

    for (let i = 0; i < rows.length; i++) {
      if (str_(rows[i][idx["login_id"]]) === loginId) {
        hitRowIndex = i + 2;
        hitEmail    = str_(rows[i][idx["email"]]);
        break;
      }
    }

    if (!hitRowIndex) return json_({ ok: false, error: "not_found" });

    const currentEp = Number(sheet.getRange(hitRowIndex, idx["ep_balance"] + 1).getValue() || 0);

    if (currentEp < amount) {
      return json_({ ok: false, error: "insufficient_ep", ep_balance: currentEp });
    }

    const newEp = currentEp - amount;
    sheet.getRange(hitRowIndex, idx["ep_balance"] + 1).setValue(newEp);

    appendWalletLedger_({
      kind:     "deduct_ep",
      login_id: loginId,
      email:    hitEmail,
      amount:   -amount,
      memo:     "narasu代理申請EPポイント払い",
    });

    return json_({ ok: true, ep_balance: newEp });
  }

  // =========================================================
  // daily_login_bonus（ログインボーナス付与：1日1回）
  // - adminKey 認証必須（GAS_ADMIN_KEY）
  // - 連続ログイン日数に応じてBPを付与
  // - 1日30BP上限クリップ
  // =========================================================
  if (action === "daily_login_bonus") {
    if (str_(body.adminKey) !== ADMIN_SECRET) {
      return json_({ ok: false, error: "admin_unauthorized" });
    }

    const loginId = str_(body.loginId);
    if (!loginId) return json_({ ok: false, error: "loginId_required" });

    let values = sheet.getDataRange().getValues();
    let header = values[0];

    // ✅ 必要列保証（壊さない）
    ensureCols_(sheet, header, [
      "login_id", "email", "bp_balance",
      "last_login_at", "login_streak",
      "daily_bp_earned", "daily_ep_earned", "daily_reset_date",
      "total_login_count",
      "mission_login_date", "mission_fortune_date",
      "mission_music_date", "mission_bonus_date",
    ]);

    values = sheet.getDataRange().getValues();
    header = values[0];

    const idx = indexMap_(header);
    const rows = values.slice(1);

    let hitRowIndex = 0;
    let hitEmail    = "";

    for (let i = 0; i < rows.length; i++) {
      if (str_(rows[i][idx["login_id"]]) === loginId) {
        hitRowIndex = i + 2;
        hitEmail    = str_(rows[i][idx["email"]]);
        break;
      }
    }

    if (!hitRowIndex) return json_({ ok: false, error: "not_found" });

    // JST の今日の日付（YYYY-MM-DD）
    const nowJst  = new Date(Date.now() + 9 * 60 * 60 * 1000);
    const todayStr = nowJst.toISOString().slice(0, 10); // "YYYY-MM-DD"

    const lastLoginRaw  = sheet.getRange(hitRowIndex, idx["last_login_at"]    + 1).getValue();
    const streakRaw     = sheet.getRange(hitRowIndex, idx["login_streak"]      + 1).getValue();
    const dailyBpRaw    = sheet.getRange(hitRowIndex, idx["daily_bp_earned"]   + 1).getValue();
    const dailyResetRaw = sheet.getRange(hitRowIndex, idx["daily_reset_date"]  + 1).getValue();
    const loginCountRaw = sheet.getRange(hitRowIndex, idx["total_login_count"] + 1).getValue();
    const bpRaw         = sheet.getRange(hitRowIndex, idx["bp_balance"]        + 1).getValue();

    // 今日既に実行済みか判定
    const lastLoginDate = lastLoginRaw ? new Date(lastLoginRaw) : null;
    const lastLoginStr  = lastLoginDate
      ? new Date(lastLoginDate.getTime() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10)
      : "";

    if (lastLoginStr === todayStr) {
      return json_({ ok: false, reason: "already_claimed" });
    }

    // 日次集計リセット（daily_reset_date が今日でなければリセット）
    const dailyResetStr = str_(dailyResetRaw);
    let dailyBpEarned   = dailyResetStr === todayStr ? Number(dailyBpRaw || 0) : 0;

    // 連続ログイン日数計算
    const yesterdayJst = new Date(nowJst.getTime() - 24 * 60 * 60 * 1000);
    const yesterdayStr = yesterdayJst.toISOString().slice(0, 10);
    let streak = lastLoginStr === yesterdayStr ? Number(streakRaw || 0) + 1 : 1;

    // streakに応じてボーナスBP決定
    let bonusBp;
    if      (streak >= 30) bonusBp = 100;
    else if (streak >= 7)  bonusBp = 20;
    else if (streak >= 3)  bonusBp = 10;
    else                   bonusBp = 5;

    // 1日30BP上限クリップ
    const BP_DAY_MAX = 30;
    const remaining  = BP_DAY_MAX - dailyBpEarned;
    const bpEarned   = remaining > 0 ? Math.min(bonusBp, remaining) : 0;

    const currentBp = Number(bpRaw || 0);
    const newBp     = currentBp + bpEarned;
    const newCount  = Number(loginCountRaw || 0) + 1;
    dailyBpEarned  += bpEarned;

    // シート書き込み
    sheet.getRange(hitRowIndex, idx["bp_balance"]        + 1).setValue(newBp);
    sheet.getRange(hitRowIndex, idx["last_login_at"]     + 1).setValue(new Date());
    sheet.getRange(hitRowIndex, idx["login_streak"]      + 1).setValue(streak);
    sheet.getRange(hitRowIndex, idx["daily_bp_earned"]   + 1).setValue(dailyBpEarned);
    sheet.getRange(hitRowIndex, idx["daily_reset_date"]  + 1).setValue(todayStr);
    sheet.getRange(hitRowIndex, idx["total_login_count"] + 1).setValue(newCount);

    if (bpEarned > 0) {
      appendWalletLedger_({
        kind:     "login_bonus",
        login_id: loginId,
        email:    hitEmail,
        amount:   bpEarned,
        memo:     "ログインボーナス（streak=" + streak + "）",
      });
    }

    return json_({ ok: true, bp_earned: bpEarned, streak: streak, bp_balance: newBp });
  }

  // =========================================================
  // monthly_bp_recover（月次BP回復：30日に1回）
  // - adminKey 認証必須（GAS_ADMIN_KEY）
  // - group:"5000" で applies_5000 シートに振り分け
  // - bp_last_reset_at で30日経過チェック（空 = 初回 = 即回復）
  // - 回復量 = min(cap×50%, max(0, cap - currentBp))
  // - cap超えの場合は回復量0だがbp_last_reset_atは更新する
  // =========================================================
  if (action === "monthly_bp_recover") {
    if (str_(body.adminKey) !== ADMIN_SECRET) {
      return json_({ ok: false, error: "admin_unauthorized" });
    }

    const loginId_rec = str_(body.loginId);
    const group_rec   = str_(body.group);
    if (!loginId_rec) return json_({ ok: false, error: "loginId_required" });

    const targetSheet_rec = group_rec === "5000" ? getAppliesSheet5000_() : sheet;

    let values_rec = targetSheet_rec.getDataRange().getValues();
    let header_rec = values_rec[0];

    ensureCols_(targetSheet_rec, header_rec, [
      "login_id", "bp_balance", "bp_last_reset_at", "plan",
    ]);

    values_rec = targetSheet_rec.getDataRange().getValues();
    header_rec = values_rec[0];

    const idx_rec  = indexMap_(header_rec);
    const rows_rec = values_rec.slice(1);

    let hitRowIndex_rec = 0;
    let hitEmail_rec    = "";

    for (let i = 0; i < rows_rec.length; i++) {
      if (str_(rows_rec[i][idx_rec["login_id"]]) === loginId_rec) {
        hitRowIndex_rec = i + 2;
        hitEmail_rec    = str_(rows_rec[i][idx_rec["email"]] || "");
        break;
      }
    }

    if (!hitRowIndex_rec) return json_({ ok: false, error: "not_found" });

    // 前回回復日チェック（30日 = 30 * 24 * 60 * 60 * 1000 ms）
    const lastResetRaw_rec = targetSheet_rec.getRange(hitRowIndex_rec, idx_rec["bp_last_reset_at"] + 1).getValue();
    if (lastResetRaw_rec) {
      const elapsed_rec = Date.now() - new Date(lastResetRaw_rec).getTime();
      if (elapsed_rec < 30 * 24 * 60 * 60 * 1000) {
        return json_({ ok: false, reason: "already_recovered" });
      }
    }

    // plan → bp_cap
    const plan_rec            = str_(targetSheet_rec.getRange(hitRowIndex_rec, idx_rec["plan"] + 1).getValue());
    const BP_CAP_MAP_REC      = { "34":300, "57":600, "114":1200, "567":6000, "1134":12000 };
    const BP_CAP_MAP_REC_5000 = { "500":1000, "2000":4000, "3000":8000, "5000":10000 };
    const capMap_rec = group_rec === "5000" ? BP_CAP_MAP_REC_5000 : BP_CAP_MAP_REC;
    const bpCap_rec  = capMap_rec[plan_rec] ?? 0;
    if (!bpCap_rec) return json_({ ok: false, reason: "unknown_plan" });

    // 回復量計算
    const currentBp_rec = Number(targetSheet_rec.getRange(hitRowIndex_rec, idx_rec["bp_balance"] + 1).getValue() || 0);
    const recover_rec   = Math.min(Math.floor(bpCap_rec * 0.5), Math.max(0, bpCap_rec - currentBp_rec));

    // bp_last_reset_at は回復量0でも更新（次の30日サイクルを開始）
    targetSheet_rec.getRange(hitRowIndex_rec, idx_rec["bp_last_reset_at"] + 1).setValue(new Date());

    if (recover_rec === 0) {
      return json_({ ok: true, bp_recovered: 0, bp_balance: currentBp_rec });
    }

    const newBp_rec = currentBp_rec + recover_rec;
    targetSheet_rec.getRange(hitRowIndex_rec, idx_rec["bp_balance"] + 1).setValue(newBp_rec);

    appendWalletLedger_({
      kind:     "monthly_recover",
      login_id: loginId_rec,
      email:    hitEmail_rec,
      amount:   recover_rec,
      memo:     "月次BP回復（cap=" + bpCap_rec + "）",
    });

    return json_({ ok: true, bp_recovered: recover_rec, bp_balance: newBp_rec });
  }

  // =========================================================
  // get_missions（今日のミッション状況取得）
  // - adminKey 認証必須（GAS_ADMIN_KEY）
  // - loginId でユーザーを検索し、ミッション列と bp_balance を返す
  // =========================================================
  if (action === "get_missions") {
    if (str_(body.adminKey) !== ADMIN_SECRET) {
      return json_({ ok: false, error: "admin_unauthorized" });
    }

    const loginId = str_(body.loginId);
    if (!loginId) return json_({ ok: false, error: "loginId_required" });

    let values = sheet.getDataRange().getValues();
    let header = values[0];

    ensureCols_(sheet, header, [
      "login_id", "email", "bp_balance",
      "mission_login_date", "mission_fortune_date",
      "mission_music_date", "mission_bonus_date",
    ]);

    values = sheet.getDataRange().getValues();
    header = values[0];

    const idx  = indexMap_(header);
    const rows = values.slice(1);

    let hitRowIndex = 0;
    let hitRow      = null;

    for (let i = 0; i < rows.length; i++) {
      if (str_(rows[i][idx["login_id"]]) === loginId) {
        hitRowIndex = i + 2;
        hitRow      = rows[i];
        break;
      }
    }

    if (!hitRowIndex) return json_({ ok: false, error: "not_found" });

    const nowJst   = new Date(Date.now() + 9 * 60 * 60 * 1000);
    const todayStr = nowJst.toISOString().slice(0, 10);

    const mLoginDate   = dateStr_(hitRow[idx["mission_login_date"]]);
    const mFortuneDate = dateStr_(hitRow[idx["mission_fortune_date"]]);
    const mMusicDate   = dateStr_(hitRow[idx["mission_music_date"]]);
    const mBonusDate   = dateStr_(hitRow[idx["mission_bonus_date"]]);
    const bpBalance    = Number(hitRow[idx["bp_balance"]] || 0);

    return json_({
      ok:    true,
      today: todayStr,
      missions: {
        login:   { done: mLoginDate   === todayStr, reward: 5  },
        fortune: { done: mFortuneDate === todayStr, reward: 10 },
        music:   { done: mMusicDate   === todayStr, reward: 15 },
      },
      all_complete_bonus: { done: mBonusDate === todayStr, reward: 20 },
      bp_balance: bpBalance,
    });
  }

  // =========================================================
  // complete_mission（ミッション完了 → BP付与）
  // - adminKey 認証必須（GAS_ADMIN_KEY）
  // - mission_type: "login" | "fortune" | "music"
  // - 1日1回制限（日付カラムで判定）
  // - 3ミッション全完了時に +20BP ボーナス自動付与
  // =========================================================
  if (action === "complete_mission") {
    if (str_(body.adminKey) !== ADMIN_SECRET) {
      return json_({ ok: false, error: "admin_unauthorized" });
    }

    const loginId     = str_(body.loginId);
    const missionType = str_(body.mission_type);

    if (!loginId)     return json_({ ok: false, error: "loginId_required" });
    if (!missionType) return json_({ ok: false, error: "mission_type_required" });

    const MISSION_COL_MAP = {
      login:   "mission_login_date",
      fortune: "mission_fortune_date",
      music:   "mission_music_date",
    };
    const MISSION_REWARD_MAP = { login: 5, fortune: 10, music: 15 };

    if (!MISSION_COL_MAP[missionType]) {
      return json_({ ok: false, error: "invalid_mission_type" });
    }

    let values = sheet.getDataRange().getValues();
    let header = values[0];

    ensureCols_(sheet, header, [
      "login_id", "email", "bp_balance",
      "mission_login_date", "mission_fortune_date",
      "mission_music_date", "mission_bonus_date",
    ]);

    values = sheet.getDataRange().getValues();
    header = values[0];

    const idx  = indexMap_(header);
    const rows = values.slice(1);

    let hitRowIndex = 0;
    let hitRow      = null;
    let hitEmail    = "";

    for (let i = 0; i < rows.length; i++) {
      if (str_(rows[i][idx["login_id"]]) === loginId) {
        hitRowIndex = i + 2;
        hitRow      = rows[i];
        hitEmail    = str_(rows[i][idx["email"]]);
        break;
      }
    }

    if (!hitRowIndex) return json_({ ok: false, error: "not_found" });

    const nowJst   = new Date(Date.now() + 9 * 60 * 60 * 1000);
    const todayStr = nowJst.toISOString().slice(0, 10);

    const missionColKey = MISSION_COL_MAP[missionType];
    const existingDate  = dateStr_(hitRow[idx[missionColKey]]);

    if (existingDate === todayStr) {
      return json_({ ok: false, reason: "already_done" });
    }

    const reward     = MISSION_REWARD_MAP[missionType];
    const currentBp  = Number(hitRow[idx["bp_balance"]] || 0);
    const newBp      = currentBp + reward;

    sheet.getRange(hitRowIndex, idx[missionColKey] + 1).setValue(todayStr);
    sheet.getRange(hitRowIndex, idx["bp_balance"]  + 1).setValue(newBp);

    appendWalletLedger_({
      kind:     "mission_" + missionType,
      login_id: loginId,
      email:    hitEmail,
      amount:   reward,
      memo:     "ミッション達成（" + missionType + "）",
    });

    // 全ミッション完了チェック → ボーナス付与
    const loginDone   = missionType === "login"   ? todayStr : dateStr_(hitRow[idx["mission_login_date"]]);
    const fortuneDone = missionType === "fortune" ? todayStr : dateStr_(hitRow[idx["mission_fortune_date"]]);
    const musicDone   = missionType === "music"   ? todayStr : dateStr_(hitRow[idx["mission_music_date"]]);
    const bonusDate   = dateStr_(hitRow[idx["mission_bonus_date"]]);

    let allCompleteBonusGiven = false;
    let finalBp = newBp;

    if (
      loginDone   === todayStr &&
      fortuneDone === todayStr &&
      musicDone   === todayStr &&
      bonusDate   !== todayStr
    ) {
      const BONUS_REWARD = 20;
      finalBp = newBp + BONUS_REWARD;
      sheet.getRange(hitRowIndex, idx["bp_balance"]      + 1).setValue(finalBp);
      sheet.getRange(hitRowIndex, idx["mission_bonus_date"] + 1).setValue(todayStr);
      appendWalletLedger_({
        kind:     "mission_all_complete",
        login_id: loginId,
        email:    hitEmail,
        amount:   BONUS_REWARD,
        memo:     "全ミッション完了ボーナス",
      });
      allCompleteBonusGiven = true;
    }

    return json_({
      ok:                  true,
      bp_earned:           reward + (allCompleteBonusGiven ? 20 : 0),
      all_complete_bonus:  allCompleteBonusGiven,
      bp_balance:          finalBp,
    });
  }

  // =========================================================
  // fortune_daily_bp（毎日の占い閲覧 → BP付与）
  // - adminKey 認証必須（GAS_ADMIN_KEY）
  // - mission_fortune_date が今日なら already_claimed を返す
  // - 付与額: +10 BP
  // =========================================================
  if (action === "fortune_daily_bp") {
    if (str_(body.adminKey) !== ADMIN_SECRET) {
      return json_({ ok: false, error: "admin_unauthorized" });
    }

    const loginId = str_(body.loginId);
    if (!loginId) return json_({ ok: false, error: "loginId_required" });

    let values = sheet.getDataRange().getValues();
    let header = values[0];

    ensureCols_(sheet, header, [
      "login_id", "email", "bp_balance", "mission_fortune_date",
    ]);

    values = sheet.getDataRange().getValues();
    header = values[0];

    const idx  = indexMap_(header);
    const rows = values.slice(1);

    let hitRowIndex = 0;
    let hitRow      = null;
    let hitEmail    = "";

    for (let i = 0; i < rows.length; i++) {
      if (str_(rows[i][idx["login_id"]]) === loginId) {
        hitRowIndex = i + 2;
        hitRow      = rows[i];
        hitEmail    = str_(rows[i][idx["email"]]);
        break;
      }
    }

    if (!hitRowIndex) return json_({ ok: false, error: "not_found" });

    const nowJst   = new Date(Date.now() + 9 * 60 * 60 * 1000);
    const todayStr = nowJst.toISOString().slice(0, 10);

    const existingDate = str_(hitRow[idx["mission_fortune_date"]]);
    if (existingDate === todayStr) {
      return json_({ ok: false, reason: "already_claimed" });
    }

    const BP_REWARD = 10;
    const currentBp = Number(hitRow[idx["bp_balance"]] || 0);
    const newBp     = currentBp + BP_REWARD;

    sheet.getRange(hitRowIndex, idx["mission_fortune_date"] + 1).setValue(todayStr);
    sheet.getRange(hitRowIndex, idx["bp_balance"]           + 1).setValue(newBp);

    appendWalletLedger_({
      kind:     "fortune_daily",
      login_id: loginId,
      email:    hitEmail,
      amount:   BP_REWARD,
      memo:     "毎日の占いBP",
    });

    return json_({ ok: true, bp_earned: BP_REWARD, bp_balance: newBp });
  }

  // =========================================================
  // gacha_spin（BPガチャ：100BP or 1000BP消費 → 新仕様抒選）
  // - is10: true なら１０連（1000BP・11回・最終250BP以上保証）
  // - 欠片・連敗救済・天井・Ticker対応
  // =========================================================
  if (action === "gacha_spin") {
    if (str_(body.adminKey) !== ADMIN_SECRET) {
      return json_({ ok: false, error: "admin_unauthorized" });
    }
    const loginId = str_(body.loginId);
    const is10    = body.is10 === true;
    if (!loginId) return json_({ ok: false, error: "loginId_required" });

    let values = sheet.getDataRange().getValues();
    let header = values[0];
    ensureCols_(sheet, header, ["login_id","email","bp_balance","gacha_count","gacha_streak","gacha_fragments"]);
    values = sheet.getDataRange().getValues();
    header = values[0];
    const idx  = indexMap_(header);
    const rows = values.slice(1);

    let hitRowIndex = 0;
    let hitEmail    = "";
    for (let i = 0; i < rows.length; i++) {
      if (str_(rows[i][idx["login_id"]]) === loginId) {
        hitRowIndex = i + 2;
        hitEmail    = str_(rows[i][idx["email"]]);
        break;
      }
    }
    if (!hitRowIndex) return json_({ ok: false, error: "not_found" });

    const GACHA_COST  = is10 ? 1000 : 100;
    const SPIN_COUNT  = is10 ? 11   : 1;
    const currentBp   = Number(sheet.getRange(hitRowIndex, idx["bp_balance"]     + 1).getValue() || 0);
    const gachaCount  = Number(sheet.getRange(hitRowIndex, idx["gacha_count"]    + 1).getValue() || 0);
    const gachaStreak = Number(sheet.getRange(hitRowIndex, idx["gacha_streak"]   + 1).getValue() || 0);
    const fragments   = Number(sheet.getRange(hitRowIndex, idx["gacha_fragments"]+ 1).getValue() || 0);

    if (currentBp < GACHA_COST) {
      return json_({ ok: false, reason: "insufficient_bp", bp_balance: currentBp });
    }

    const PRIZES  = [5,   10,  20,  40,   80,  150,  300,   600,   1000,  5000,  20000];
    const WEIGHTS = [28,  24,  18,  12,   8,   5,    3,     0.80,  1.00,  0.18,  0.02 ];
    const RARITY  = ["common","common","common","common","uncommon","uncommon","rare","epic","legendary","mythic","god"];

    function spinOnce(streakIn, countIn, forceGood) {
      if (countIn >= 100) {
        const godP = [1000,5000,20000], godW = [70,25,5];
        let r2 = Math.random()*100, c2 = 0, p = 1000;
        for (let g=0;g<godP.length;g++){c2+=godW[g];if(r2<c2){p=godP[g];break;}}
        return {prize_bp:p, rarity: p>=20000?"god":p>=5000?"mythic":"legendary"};
      }
      let useW = WEIGHTS.slice();
      if (streakIn >= 10) useW = [0,0,0,0,0,40,35,18,6,1,0]; else if (forceGood) useW = [0,0,0,0,0,50,30,15,4,1,0];
      if (countIn >= 50) { useW[5]+=3; useW[6]+=2; useW[7]+=1; }
      const total = useW.reduce((a,b)=>a+b,0);
      let r3 = Math.random()*total, c3 = 0, prize = PRIZES[0], rar = RARITY[0];
      for (let k=0;k<PRIZES.length;k++){c3+=useW[k];if(r3<c3){prize=PRIZES[k];rar=RARITY[k];break;}}
      return {prize_bp:prize, rarity:rar};
    }

    const results = [];
    let totalPrize = 0, newStreak = gachaStreak, newCount = gachaCount, newFrag = fragments;
    for (let s=0;s<SPIN_COUNT;s++){
      const forceGood = is10 && s===SPIN_COUNT-1; // 150BP以上保証
      const hitPity = newCount >= 100; // 天井発動チェック（spin前）
      const r = spinOnce(newStreak, newCount, forceGood);
      totalPrize += r.prize_bp;
      newFrag    += 1;
      if (hitPity) newCount = 0; // 天井発動後はカウントをリセット
      newCount   += 1;
      if (r.prize_bp < 250) newStreak += 1; else newStreak = 0;
      results.push(r);
    }

    const newBp = currentBp - GACHA_COST + totalPrize;
    sheet.getRange(hitRowIndex, idx["bp_balance"]     + 1).setValue(newBp);
    sheet.getRange(hitRowIndex, idx["gacha_count"]    + 1).setValue(newCount);
    sheet.getRange(hitRowIndex, idx["gacha_streak"]   + 1).setValue(newStreak);
    sheet.getRange(hitRowIndex, idx["gacha_fragments"]+ 1).setValue(newFrag);

    appendWalletLedger_({kind:"gacha_cost",  login_id:loginId, email:hitEmail, amount:-GACHA_COST, memo: is10?"10連ガチャ消費":"ガチャ消費"});
    appendWalletLedger_({kind:"gacha_prize", login_id:loginId, email:hitEmail, amount:totalPrize,  memo:"ガチャ当選（"+totalPrize+"BP）"});

    const maxPrize = Math.max(...results.map(r=>r.prize_bp));
    if (maxPrize >= 1000) {
      const ss2 = SpreadsheetApp.getActiveSpreadsheet();
      let tickerSheet = ss2.getSheetByName("gacha_ticker");
      if (!tickerSheet) { tickerSheet = ss2.insertSheet("gacha_ticker"); tickerSheet.appendRow(["id","masked_id","prize_bp","created_at"]); }
      const masked = loginId.length > 2 ? loginId.slice(0,2)+"***" : loginId+"***";
      tickerSheet.appendRow([Utilities.getUuid(), masked, maxPrize, new Date().toISOString()]);
    }

    return json_({
      ok:          true,
      cost:        GACHA_COST,
      prize_bp:    totalPrize,
      bp_balance:  newBp,
      net:         totalPrize - GACHA_COST,
      results:     results,
      fragments:   newFrag,
      gacha_count: newCount,
      rarity:      results[results.length-1].rarity,
      to_pity:     Math.max(0, 100 - newCount),
    });
  }

  if (action === "gacha_daily")        return gachaDailySpin_(body);
  if (action === "gacha_daily_status") return gachaDailyStatus_(body);

  // =========================================================
  // get_radio_songs（ラジオ楽曲一覧取得：active=trueのみ返す）
  // - adminKey 認証必須（GAS_ADMIN_KEY）
  // =========================================================
  if (action === "get_radio_songs") {
    if (str_(body.adminKey) !== ADMIN_SECRET) {
      return json_({ ok: false, error: "admin_unauthorized" });
    }

    const songsSheet = getOrCreateRadioSongsSheet_();
    const sValues    = songsSheet.getDataRange().getValues();
    const sHeader    = sValues[0];
    const sIdx       = indexMap_(sHeader);
    const sRows      = sValues.slice(1);

    const songs = [];
    for (let i = 0; i < sRows.length; i++) {
      const row = sRows[i];
      const activeVal = row[sIdx["active"]];
      if (activeVal !== true && str_(activeVal) !== "TRUE" && str_(activeVal) !== "true" && str_(activeVal) !== "1") continue;
      let serviceLinks = {};
      try { serviceLinks = JSON.parse(str_(row[sIdx["service_links"]]) || "{}"); } catch (e) {}
      songs.push({
        song_id:       str_(row[sIdx["song_id"]]),
        title:         str_(row[sIdx["title"]]),
        artist:        str_(row[sIdx["artist"]]),
        service_links: serviceLinks,
        thumbnail_url: str_(row[sIdx["thumbnail_url"]]),
      });
    }

    return json_({ ok: true, songs: songs });
  }

  // =========================================================
  // get_radio_status（今日のラジオミッション状況取得）
  // - adminKey 認証必須（GAS_ADMIN_KEY）
  // =========================================================
  if (action === "get_radio_status") {
    if (str_(body.adminKey) !== ADMIN_SECRET) {
      return json_({ ok: false, error: "admin_unauthorized" });
    }

    const loginId = str_(body.loginId);
    if (!loginId) return json_({ ok: false, error: "loginId_required" });

    const nowJst   = new Date(Date.now() + 9 * 60 * 60 * 1000);
    const todayStr = nowJst.toISOString().slice(0, 10);

    // applies からサブスクプランを取得
    let values = sheet.getDataRange().getValues();
    let header = values[0];
    ensureCols_(sheet, header, ["login_id", "subscription_plan"]);
    values = sheet.getDataRange().getValues();
    header = values[0];
    const idx  = indexMap_(header);
    const rows = values.slice(1);
    let subPlan = "free";
    for (let i = 0; i < rows.length; i++) {
      if (str_(rows[i][idx["login_id"]]) === loginId) {
        const p = str_(rows[i][idx["subscription_plan"]]);
        if (p) subPlan = p;
        break;
      }
    }

    const PLAN_LIMITS = { free: 1, plus: 3, pro: 5, priority: 5, partner: 5 };
    const dailyLimit = PLAN_LIMITS[subPlan] || 1;

    // radio_missions から今日の集計
    const missionsSheet = getOrCreateRadioMissionsSheet_();
    const mValues = missionsSheet.getDataRange().getValues();
    const mHeader = mValues[0];
    const mIdx    = indexMap_(mHeader);
    const mRows   = mValues.slice(1);

    let todayCount    = 0;
    let startedMission = null;

    for (let i = 0; i < mRows.length; i++) {
      const row = mRows[i];
      if (str_(row[mIdx["login_id"]]) !== loginId) continue;
      const status = str_(row[mIdx["status"]]);

      // submitted/approved を今日の達成件数としてカウント
      const submittedAt = row[mIdx["submitted_at"]];
      if (submittedAt && (status === "submitted" || status === "approved")) {
        const submittedStr = new Date(new Date(submittedAt).getTime() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10);
        if (submittedStr === todayStr) todayCount++;
      }

      // started かつ未提出のミッション
      if (status === "started") {
        const startedAt = row[mIdx["started_at"]];
        const startedStr = startedAt
          ? new Date(new Date(startedAt).getTime() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10)
          : "";
        if (startedStr === todayStr) {
          startedMission = {
            mission_id: str_(row[mIdx["mission_id"]]),
            song_id:    str_(row[mIdx["song_id"]]),
            started_at: startedAt ? new Date(startedAt).toISOString() : "",
          };
        }
      }
    }

    return json_({
      ok:              true,
      today_count:     todayCount,
      daily_limit:     dailyLimit,
      remaining:       Math.max(0, dailyLimit - todayCount),
      started_mission: startedMission,
    });
  }

  // =========================================================
  // radio_start（ラジオ視聴開始）
  // - adminKey 認証必須（GAS_ADMIN_KEY）
  // =========================================================
  if (action === "radio_start") {
    if (str_(body.adminKey) !== ADMIN_SECRET) {
      return json_({ ok: false, error: "admin_unauthorized" });
    }

    const loginId = str_(body.loginId);
    const songId  = str_(body.song_id);
    if (!loginId) return json_({ ok: false, error: "loginId_required" });
    if (!songId)  return json_({ ok: false, error: "song_id_required" });

    const nowJst   = new Date(Date.now() + 9 * 60 * 60 * 1000);
    const todayStr = nowJst.toISOString().slice(0, 10);

    // applies からサブスクプランを取得
    let values = sheet.getDataRange().getValues();
    let header = values[0];
    ensureCols_(sheet, header, ["login_id", "subscription_plan"]);
    values = sheet.getDataRange().getValues();
    header = values[0];
    const idx  = indexMap_(header);
    const rows = values.slice(1);
    let subPlan = "free";
    for (let i = 0; i < rows.length; i++) {
      if (str_(rows[i][idx["login_id"]]) === loginId) {
        const p = str_(rows[i][idx["subscription_plan"]]);
        if (p) subPlan = p;
        break;
      }
    }

    const PLAN_LIMITS = { free: 1, plus: 3, pro: 5, priority: 5, partner: 5 };
    const dailyLimit = PLAN_LIMITS[subPlan] || 1;

    // radio_missions から今日の集計
    const missionsSheet = getOrCreateRadioMissionsSheet_();
    const mValues = missionsSheet.getDataRange().getValues();
    const mHeader = mValues[0];
    const mIdx    = indexMap_(mHeader);
    const mRows   = mValues.slice(1);

    let todayDoneCount = 0;
    for (let i = 0; i < mRows.length; i++) {
      const row    = mRows[i];
      if (str_(row[mIdx["login_id"]]) !== loginId) continue;
      const status = str_(row[mIdx["status"]]);
      if (status === "submitted" || status === "approved") {
        const submittedAt = row[mIdx["submitted_at"]];
        if (submittedAt) {
          const submittedStr = new Date(new Date(submittedAt).getTime() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10);
          if (submittedStr === todayStr) todayDoneCount++;
        }
      }
      // 同じ song_id で today started かつ未提出
      if (status === "started" && str_(row[mIdx["song_id"]]) === songId) {
        const startedAt  = row[mIdx["started_at"]];
        const startedStr = startedAt
          ? new Date(new Date(startedAt).getTime() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10)
          : "";
        if (startedStr === todayStr) return json_({ ok: false, reason: "already_started" });
      }
    }

    if (todayDoneCount >= dailyLimit) return json_({ ok: false, reason: "daily_limit" });

    const missionId = "rdm_" + Utilities.getUuid().slice(0, 8);
    missionsSheet.appendRow([
      missionId,
      loginId,
      songId,
      nowJst,
      "",
      "started",
      "",
      "",
    ]);

    return json_({ ok: true, mission_id: missionId, started_at: nowJst.toISOString() });
  }

  // =========================================================
  // radio_submit（ラジオ視聴完了申請 → v1はオート承認・EP付与）
  // - adminKey 認証必須（GAS_ADMIN_KEY）
  // =========================================================
  if (action === "radio_submit") {
    if (str_(body.adminKey) !== ADMIN_SECRET) {
      return json_({ ok: false, error: "admin_unauthorized" });
    }

    const loginId        = str_(body.loginId);
    const missionId      = str_(body.mission_id);
    const screenshotNote = str_(body.screenshot_note);
    if (!loginId)   return json_({ ok: false, error: "loginId_required" });
    if (!missionId) return json_({ ok: false, error: "mission_id_required" });

    // radio_missions から mission_id で行を検索
    const missionsSheet = getOrCreateRadioMissionsSheet_();
    const mValues = missionsSheet.getDataRange().getValues();
    const mHeader = mValues[0];
    const mIdx    = indexMap_(mHeader);
    const mRows   = mValues.slice(1);

    let mHitRowIndex = 0;
    let mHitRow      = null;
    for (let i = 0; i < mRows.length; i++) {
      if (str_(mRows[i][mIdx["mission_id"]]) === missionId) {
        mHitRowIndex = i + 2;
        mHitRow      = mRows[i];
        break;
      }
    }
    if (!mHitRowIndex)                                     return json_({ ok: false, reason: "not_found" });
    if (str_(mHitRow[mIdx["login_id"]]) !== loginId)      return json_({ ok: false, reason: "not_found" });
    if (str_(mHitRow[mIdx["status"]]) !== "started")      return json_({ ok: false, reason: "invalid_status" });

    const nowJst      = new Date(Date.now() + 9 * 60 * 60 * 1000);
    const RADIO_EP    = 5;

    // submitted_at / screenshot_note / status → submitted
    missionsSheet.getRange(mHitRowIndex, mIdx["submitted_at"]    + 1).setValue(nowJst);
    missionsSheet.getRange(mHitRowIndex, mIdx["screenshot_note"] + 1).setValue(screenshotNote);
    missionsSheet.getRange(mHitRowIndex, mIdx["status"]          + 1).setValue("submitted");

    // v1 オート承認: EP付与
    // applies から ep_balance を更新
    let values = sheet.getDataRange().getValues();
    let header = values[0];
    ensureCols_(sheet, header, ["login_id", "email", "ep_balance"]);
    values = sheet.getDataRange().getValues();
    header = values[0];
    const idx  = indexMap_(header);
    const rows = values.slice(1);

    let hitRowIndex = 0;
    let hitEmail    = "";
    let currentEp   = 0;
    for (let i = 0; i < rows.length; i++) {
      if (str_(rows[i][idx["login_id"]]) === loginId) {
        hitRowIndex = i + 2;
        hitEmail    = str_(rows[i][idx["email"]]);
        currentEp   = Number(rows[i][idx["ep_balance"]] || 0);
        break;
      }
    }

    let newEp = currentEp;
    if (hitRowIndex) {
      newEp = currentEp + RADIO_EP;
      sheet.getRange(hitRowIndex, idx["ep_balance"] + 1).setValue(newEp);
    }

    // ep_granted / status → approved
    missionsSheet.getRange(mHitRowIndex, mIdx["ep_granted"] + 1).setValue(RADIO_EP);
    missionsSheet.getRange(mHitRowIndex, mIdx["status"]     + 1).setValue("approved");

    appendWalletLedger_({
      kind:     "radio_ep",
      login_id: loginId,
      email:    hitEmail,
      amount:   RADIO_EP,
      memo:     "LIFAI RADIO視聴EP（mission_id=" + missionId + "）",
    });

    return json_({ ok: true, ep_granted: RADIO_EP, ep_balance: newEp });
  }

  // =========================================================
  // stake_bp（BPステーキング開始：BPを預けて満期後に利息付きで受け取る）
  // - adminKey 認証必須（GAS_ADMIN_KEY）
  // - 最低100BP / days: 30 | 60 | 90
  // =========================================================
  if (action === "stake_bp") {
    if (str_(body.adminKey) !== ADMIN_SECRET) {
      return json_({ ok: false, error: "admin_unauthorized" });
    }

    const loginId = str_(body.loginId);
    const amount  = Number(body.amount);
    const days    = Number(body.days);

    if (!loginId) return json_({ ok: false, error: "loginId_required" });
    if (amount < 100) return json_({ ok: false, reason: "min_100" });

    const RATE_MAP = { 30: 0.10, 60: 0.25, 90: 0.50 };
    if (!RATE_MAP[days]) return json_({ ok: false, reason: "invalid_days" });

    // applies シートからユーザー検索
    let values = sheet.getDataRange().getValues();
    let header = values[0];
    ensureCols_(sheet, header, ["login_id", "email", "bp_balance"]);
    values = sheet.getDataRange().getValues();
    header = values[0];
    const idx  = indexMap_(header);
    const rows = values.slice(1);

    let hitRowIndex = 0;
    let hitEmail    = "";
    for (let i = 0; i < rows.length; i++) {
      if (str_(rows[i][idx["login_id"]]) === loginId) {
        hitRowIndex = i + 2;
        hitEmail    = str_(rows[i][idx["email"]]);
        break;
      }
    }
    if (!hitRowIndex) return json_({ ok: false, error: "not_found" });

    const currentBp = Number(sheet.getRange(hitRowIndex, idx["bp_balance"] + 1).getValue() || 0);
    if (currentBp < amount) {
      return json_({ ok: false, reason: "insufficient_bp", bp_balance: currentBp });
    }

    const rate       = RATE_MAP[days];
    const interestBp = Math.floor(amount * rate);
    const totalBp    = amount + interestBp;

    const nowJst     = new Date(Date.now() + 9 * 60 * 60 * 1000);
    const expiresJst = new Date(nowJst.getTime() + days * 24 * 60 * 60 * 1000);
    const stakeId    = "stk_" + Utilities.getUuid().slice(0, 8);

    // BPを引く
    const newBp = currentBp - amount;
    sheet.getRange(hitRowIndex, idx["bp_balance"] + 1).setValue(newBp);

    // staking シートに追記
    const stakingSheet = getOrCreateStakingSheet_();
    stakingSheet.appendRow([
      stakeId,
      loginId,
      amount,
      rate,
      nowJst,
      expiresJst,
      "active",
      "",
      interestBp,
      totalBp,
    ]);

    appendWalletLedger_({
      kind:     "stake_lock",
      login_id: loginId,
      email:    hitEmail,
      amount:   -amount,
      memo:     "BPステーキング預入（" + days + "日 " + (rate * 100) + "%）",
    });

    return json_({
      ok:         true,
      stake_id:   stakeId,
      staked_bp:  amount,
      interest_bp: interestBp,
      total_bp:   totalBp,
      expires_at: expiresJst.toISOString(),
      bp_balance: newBp,
    });
  }

  // =========================================================
  // get_stakes（ステーク一覧取得）
  // - adminKey 認証必須（GAS_ADMIN_KEY）
  // - loginId のステーク行を全件返す（claimable フラグ付き）
  // =========================================================
  if (action === "get_stakes") {
    if (str_(body.adminKey) !== ADMIN_SECRET) {
      return json_({ ok: false, error: "admin_unauthorized" });
    }

    const loginId = str_(body.loginId);
    if (!loginId) return json_({ ok: false, error: "loginId_required" });

    // applies から bp_balance 取得
    let values = sheet.getDataRange().getValues();
    let header = values[0];
    ensureCols_(sheet, header, ["login_id", "bp_balance"]);
    values = sheet.getDataRange().getValues();
    header = values[0];
    const idx  = indexMap_(header);
    const rows = values.slice(1);
    let bpBalance = 0;
    for (let i = 0; i < rows.length; i++) {
      if (str_(rows[i][idx["login_id"]]) === loginId) {
        bpBalance = Number(rows[i][idx["bp_balance"]] || 0);
        break;
      }
    }

    // staking シートから該当行を取得
    const stakingSheet = getOrCreateStakingSheet_();
    const sValues = stakingSheet.getDataRange().getValues();
    const sHeader = sValues[0];
    const sIdx    = indexMap_(sHeader);
    const sRows   = sValues.slice(1);

    const nowMs = Date.now();
    const stakes = [];
    for (let i = 0; i < sRows.length; i++) {
      const row = sRows[i];
      if (str_(row[sIdx["login_id"]]) !== loginId) continue;
      const expiresAt = row[sIdx["expires_at"]];
      const expiresMs = expiresAt ? new Date(expiresAt).getTime() : 0;
      const status    = str_(row[sIdx["status"]]);
      const claimable = status === "active" && nowMs > expiresMs;
      stakes.push({
        stake_id:    str_(row[sIdx["stake_id"]]),
        staked_bp:   Number(row[sIdx["staked_bp"]] || 0),
        rate:        Number(row[sIdx["rate"]] || 0),
        interest_bp: Number(row[sIdx["interest_bp"]] || 0),
        total_bp:    Number(row[sIdx["total_bp"]] || 0),
        started_at:  row[sIdx["started_at"]] ? new Date(row[sIdx["started_at"]]).toISOString() : "",
        expires_at:  expiresAt ? new Date(expiresAt).toISOString() : "",
        status:      status,
        claimed_at:  row[sIdx["claimed_at"]] ? new Date(row[sIdx["claimed_at"]]).toISOString() : "",
        claimable:   claimable,
      });
    }

    return json_({ ok: true, stakes: stakes, bp_balance: bpBalance });
  }

  // =========================================================
  // claim_stake（ステーク受け取り：満期を迎えたステークを受け取る）
  // - adminKey 認証必須（GAS_ADMIN_KEY）
  // =========================================================
  if (action === "claim_stake") {
    if (str_(body.adminKey) !== ADMIN_SECRET) {
      return json_({ ok: false, error: "admin_unauthorized" });
    }

    const loginId = str_(body.loginId);
    const stakeId = str_(body.stake_id);
    if (!loginId) return json_({ ok: false, error: "loginId_required" });
    if (!stakeId) return json_({ ok: false, error: "stake_id_required" });

    // staking シートから stake_id で行を検索
    const stakingSheet = getOrCreateStakingSheet_();
    const sValues = stakingSheet.getDataRange().getValues();
    const sHeader = sValues[0];
    const sIdx    = indexMap_(sHeader);
    const sRows   = sValues.slice(1);

    let sHitRowIndex = 0;
    let sHitRow      = null;
    for (let i = 0; i < sRows.length; i++) {
      if (str_(sRows[i][sIdx["stake_id"]]) === stakeId) {
        sHitRowIndex = i + 2;
        sHitRow      = sRows[i];
        break;
      }
    }
    if (!sHitRowIndex) return json_({ ok: false, reason: "not_found" });
    if (str_(sHitRow[sIdx["login_id"]]) !== loginId) return json_({ ok: false, reason: "not_found" });
    if (str_(sHitRow[sIdx["status"]]) !== "active") return json_({ ok: false, reason: "already_claimed" });

    const expiresAt = sHitRow[sIdx["expires_at"]];
    const expiresMs = expiresAt ? new Date(expiresAt).getTime() : 0;
    if (Date.now() <= expiresMs) return json_({ ok: false, reason: "not_matured" });

    const totalBp = Number(sHitRow[sIdx["total_bp"]] || 0);

    // applies シートから bp_balance 取得・更新
    let values = sheet.getDataRange().getValues();
    let header = values[0];
    ensureCols_(sheet, header, ["login_id", "email", "bp_balance"]);
    values = sheet.getDataRange().getValues();
    header = values[0];
    const idx  = indexMap_(header);
    const rows = values.slice(1);

    let hitRowIndex = 0;
    let hitEmail    = "";
    let currentBp   = 0;
    for (let i = 0; i < rows.length; i++) {
      if (str_(rows[i][idx["login_id"]]) === loginId) {
        hitRowIndex = i + 2;
        hitEmail    = str_(rows[i][idx["email"]]);
        currentBp   = Number(rows[i][idx["bp_balance"]] || 0);
        break;
      }
    }
    if (!hitRowIndex) return json_({ ok: false, error: "user_not_found" });

    const newBp = currentBp + totalBp;
    sheet.getRange(hitRowIndex, idx["bp_balance"] + 1).setValue(newBp);

    // staking シートを更新
    const nowJst = new Date(Date.now() + 9 * 60 * 60 * 1000);
    stakingSheet.getRange(sHitRowIndex, sIdx["status"]     + 1).setValue("claimed");
    stakingSheet.getRange(sHitRowIndex, sIdx["claimed_at"] + 1).setValue(nowJst);

    appendWalletLedger_({
      kind:     "stake_claim",
      login_id: loginId,
      email:    hitEmail,
      amount:   totalBp,
      memo:     "BPステーキング受取（stake_id=" + stakeId + "）",
    });

    return json_({ ok: true, total_bp: totalBp, bp_balance: newBp });
  }

  // =========================================================
  // reset_password（token検証 → 新PW hash更新 → token無効化）
  // =========================================================
  if (action === "reset_password") {
    const token = str_(body.token);
    const password = str_(body.password);

    if (!token || !password) {
      return json_({ ok: false, error: "missing_fields" });
    }

    let values = sheet.getDataRange().getValues();
    let header = values[0];

    // ✅ 必要列保証（壊さない）
    ensureCols_(sheet, header, [
      "login_id",
      "pw_hash",
      "pw_updated_at",
      "reset_token",
      "reset_expires",
      "reset_used_at",
    ]);

    values = sheet.getDataRange().getValues();
    header = values[0];

    const idx = indexMap_(header);
    const rows = values.slice(1);

    let hitRowIndex = 0;

    for (let i = 0; i < rows.length; i++) {
      if (str_(rows[i][idx["reset_token"]]) === token) {
        hitRowIndex = i + 2;
        break;
      }
    }

    // /5000シートも検索（通常シートで見つからない場合）
    let is5000_rp = false;
    let targetSheet_rp = sheet;
    let targetIdx_rp = idx;
    let targetHitRow_rp = hitRowIndex;

    if (!hitRowIndex) {
      const ssId_rp5 = PropertiesService.getScriptProperties().getProperty("SPREADSHEET_5000_ID");
      if (ssId_rp5) {
        const sheet5000_rp = SpreadsheetApp.openById(ssId_rp5).getSheetByName("applies");
        if (sheet5000_rp) {
          ensureCols_(sheet5000_rp, sheet5000_rp.getDataRange().getValues()[0], [
            "login_id", "pw_hash", "pw_updated_at", "reset_token", "reset_expires", "reset_used_at"
          ]);
          const vals5000_rp = sheet5000_rp.getDataRange().getValues();
          const hdr5000_rp = vals5000_rp[0];
          const idx5000_rp = indexMap_(hdr5000_rp);
          const rows5000_rp = vals5000_rp.slice(1);
          for (let i = 0; i < rows5000_rp.length; i++) {
            if (str_(rows5000_rp[i][idx5000_rp["reset_token"]]) === token) {
              targetHitRow_rp = i + 2;
              is5000_rp = true;
              targetSheet_rp = sheet5000_rp;
              targetIdx_rp = idx5000_rp;
              break;
            }
          }
        }
      }
    }

    if (!targetHitRow_rp) return json_({ ok: false, error: "invalid_token" });

    // 期限チェック（追加：安全）
    const exp = targetSheet_rp.getRange(targetHitRow_rp, targetIdx_rp["reset_expires"] + 1).getValue();
    if (exp && new Date(exp).getTime && new Date(exp).getTime() < Date.now()) {
      return json_({ ok: false, error: "token_expired" });
    }

    // 使用済みチェック（追加：安全）
    const used = targetSheet_rp.getRange(targetHitRow_rp, targetIdx_rp["reset_used_at"] + 1).getValue();
    if (used) {
      return json_({ ok: false, error: "token_used" });
    }

    const loginId = str_(targetSheet_rp.getRange(targetHitRow_rp, targetIdx_rp["login_id"] + 1).getValue());
    if (!loginId) return json_({ ok: false, error: "missing_login_id" });

    // /5000グループは平文で保存、通常グループはハッシュで保存
    const pwValue = is5000_rp ? password : hmacSha256Hex_(SECRET, loginId + ":" + password);

    targetSheet_rp.getRange(targetHitRow_rp, targetIdx_rp["pw_hash"] + 1).setValue(pwValue);
    targetSheet_rp.getRange(targetHitRow_rp, targetIdx_rp["pw_updated_at"] + 1).setValue(new Date());
    targetSheet_rp.getRange(targetHitRow_rp, targetIdx_rp["reset_used_at"] + 1).setValue(new Date());
    targetSheet_rp.getRange(targetHitRow_rp, targetIdx_rp["reset_token"] + 1).setValue("");

    return json_({ ok: true });
  }

  // =========================================================
  // ✅ user_reset_request（ユーザー自身：パスワード再設定メールを送る）
  // - loginId または email を受け取り、approved ユーザーならリセットメールを送信
  // - adminKey 不要（ユーザー自身が呼ぶ）
  // - ユーザーが存在しない場合もエラー内容を返さない（列挙攻撃対策）
  // =========================================================
  if (action === "user_reset_request") {
    const inputId = str_(body.id);      // loginId or email
    if (!inputId) return json_({ ok: false, error: "missing_id" });

    let values = sheet.getDataRange().getValues();
    let header = values[0];

    ensureCols_(sheet, header, [
      "email", "status", "login_id",
      "reset_token", "reset_expires", "reset_used_at", "reset_sent_at",
    ]);

    values = sheet.getDataRange().getValues();
    header = values[0];
    const idx = indexMap_(header);
    const rows = values.slice(1);

    let hitRowIndex = 0;
    for (let i = 0; i < rows.length; i++) {
      const r = rows[i];
      const loginId = str_(r[idx["login_id"]]);
      const email   = str_(r[idx["email"]]);
      if (inputId === loginId || inputId === email) {
        hitRowIndex = i + 2;
        break;
      }
    }

    // 存在しない・未承認でも同じレスポンスを返す（列挙対策）
    if (!hitRowIndex) return json_({ ok: true });
    const status = str_(sheet.getRange(hitRowIndex, idx["status"] + 1).getValue());
    if (status !== "approved") return json_({ ok: true });

    const loginId2 = str_(sheet.getRange(hitRowIndex, idx["login_id"] + 1).getValue());
    const email2   = str_(sheet.getRange(hitRowIndex, idx["email"] + 1).getValue());
    if (!loginId2 || !email2) return json_({ ok: true });

    const token   = genResetToken_();
    const expires = new Date(Date.now() + 72 * 60 * 60 * 1000);

    sheet.getRange(hitRowIndex, idx["reset_token"]   + 1).setValue(token);
    sheet.getRange(hitRowIndex, idx["reset_expires"]  + 1).setValue(expires);
    sheet.getRange(hitRowIndex, idx["reset_used_at"]  + 1).setValue("");

    const myRefCode2 = idx["my_ref_code"] !== undefined ? str_(sheet.getRange(hitRowIndex, idx["my_ref_code"] + 1).getValue()) : "";
    sendResetMail_(email2, loginId2, token, myRefCode2);
    sheet.getRange(hitRowIndex, idx["reset_sent_at"] + 1).setValue(new Date());

    return json_({ ok: true });
  }

  // =========================================================
  // ✅ user_id_remind（ユーザー自身：loginID をメールで再送）
  // - メールアドレスを受け取り、approved ユーザーなら loginId をメールで送信
  // - adminKey 不要（ユーザー自身が呼ぶ）
  // - ユーザーが存在しない場合もエラー内容を返さない（列挙攻撃対策）
  // =========================================================
  if (action === "user_id_remind") {
    const emailIn = str_(body.email);
    if (!emailIn) return json_({ ok: false, error: "missing_email" });

    let values = sheet.getDataRange().getValues();
    let header = values[0];

    ensureCols_(sheet, header, ["email", "status", "login_id"]);

    values = sheet.getDataRange().getValues();
    header = values[0];
    const idx = indexMap_(header);
    const rows = values.slice(1);

    let hitLoginId = "";
    for (let i = 0; i < rows.length; i++) {
      const r = rows[i];
      const email  = str_(r[idx["email"]]);
      const status = str_(r[idx["status"]]);
      if (emailIn === email && status === "approved") {
        hitLoginId = str_(r[idx["login_id"]]);
        break;
      }
    }

    // 存在しない場合も同じレスポンス（列挙対策）
    if (hitLoginId) {
      const subject = "【LIFAI】ログインID のご案内";
      const mailBody =
        "ご登録のメールアドレスへ、ログインIDをお送りします。\n\n" +
        "ログインID：\n" +
        hitLoginId +
        "\n\n" +
        "ログイン画面はこちら：\n" +
        "https://lifai.vercel.app/login\n\n" +
        "LIFAI公式";
      MailApp.sendEmail({ to: emailIn, subject: subject, body: mailBody, name: "LIFAI公式" });
    }

    return json_({ ok: true });
  }

  // =========================================================
  // ✅ reset_resend（管理：初回パスワード設定メールの再送）
  // - 期限切れ/見逃し対応のための再送アクション（壊さない）
  // - adminKey 必須（安全）
  // - id は login_id or email を許容（壊さない）
  // - status が approved の人のみ再送（安全）
  // - reset_token/reset_expires を再発行し、reset_used_at を空にし、reset_sent_at を更新して送信
  // =========================================================
  if (action === "reset_resend") {
    if (str_(body.adminKey) !== ADMIN_SECRET) {
      return json_({ ok: false, error: "admin_unauthorized" });
    }

    const id = str_(body.id);
    const emailIn = str_(body.email);

    if (!id && !emailIn) {
      return json_({ ok: false, error: "missing_id_or_email" });
    }

    let values = sheet.getDataRange().getValues();
    let header = values[0];

    // ✅ 必要列保証（壊さない）
    ensureCols_(sheet, header, [
      "email",
      "status",
      "login_id",
      "reset_token",
      "reset_expires",
      "reset_used_at",
      "reset_sent_at",
    ]);

    values = sheet.getDataRange().getValues();
    header = values[0];

    const idx = indexMap_(header);
    const rows = values.slice(1);

    let hitRowIndex = 0;

    for (let i = 0; i < rows.length; i++) {
      const r = rows[i];
      const rowIndex = i + 2;

      const loginId = str_(r[idx["login_id"]]);
      const email = str_(r[idx["email"]]);

      if ((id && (id === loginId || id === email)) || (emailIn && emailIn === email)) {
        hitRowIndex = rowIndex;
        break;
      }
    }

    if (!hitRowIndex) {
      return json_({ ok: false, error: "not_found" });
    }

    const status = str_(sheet.getRange(hitRowIndex, idx["status"] + 1).getValue());
    if (status !== "approved") {
      return json_({ ok: false, error: "not_approved" });
    }

    const loginId2 = str_(sheet.getRange(hitRowIndex, idx["login_id"] + 1).getValue());
    const email2 = str_(sheet.getRange(hitRowIndex, idx["email"] + 1).getValue());

    if (!loginId2 || !email2) {
      return json_({ ok: false, error: "missing_login_or_email" });
    }

    // RESET TOKEN再発行（30分）
    const token = genResetToken_();
    const expires = new Date(Date.now() + 72 * 60 * 60 * 1000);

    sheet.getRange(hitRowIndex, idx["reset_token"] + 1).setValue(token);
    sheet.getRange(hitRowIndex, idx["reset_expires"] + 1).setValue(expires);
    sheet.getRange(hitRowIndex, idx["reset_used_at"] + 1).setValue("");

    const myRefCodeResend = idx["my_ref_code"] !== undefined ? str_(sheet.getRange(hitRowIndex, idx["my_ref_code"] + 1).getValue()) : "";
    sendResetMail_(email2, loginId2, token, myRefCodeResend);
    sheet.getRange(hitRowIndex, idx["reset_sent_at"] + 1).setValue(new Date());

    return json_({ ok: true });
  }

  // =========================================================
  // ✅ user_reset_request（ユーザー自身によるパスワード再設定申請）
  // - adminKey不要（ユーザー向け公開エンドポイント）
  // - id は login_id or email を許容
  // - status が approved の人のみメール送信（安全）
  // - 存在しない・未承認でも ok:true を返す（ユーザー列挙攻撃対策）
  // - メイン applies シート → 5000シートの順で検索
  // - reset_token/reset_expires を再発行し reset_used_at をクリアして送信
  // =========================================================
  if (action === "user_reset_request") {
    const id_urr = str_(body.id);
    if (!id_urr) return json_({ ok: true });

    let values_urr = sheet.getDataRange().getValues();
    let header_urr = values_urr[0];

    ensureCols_(sheet, header_urr, [
      "email", "status", "login_id",
      "reset_token", "reset_expires", "reset_used_at", "reset_sent_at",
    ]);

    values_urr = sheet.getDataRange().getValues();
    header_urr = values_urr[0];
    const idx_urr = indexMap_(header_urr);
    const rows_urr = values_urr.slice(1);

    let hitRow_urr = 0;
    let targetSheet_urr = sheet;
    let targetIdx_urr = idx_urr;
    let plan_urr = "";

    for (let i = 0; i < rows_urr.length; i++) {
      const loginId = str_(rows_urr[i][idx_urr["login_id"]]);
      const email   = str_(rows_urr[i][idx_urr["email"]]);
      if (id_urr === loginId || id_urr === email) {
        hitRow_urr = i + 2;
        break;
      }
    }

    // メインで見つからなければ 5000 シートも検索
    if (!hitRow_urr) {
      const ssId_urr = PropertiesService.getScriptProperties().getProperty("SPREADSHEET_5000_ID");
      if (ssId_urr) {
        const sheet5000_urr = SpreadsheetApp.openById(ssId_urr).getSheetByName("applies");
        if (sheet5000_urr) {
          ensureCols_(sheet5000_urr, sheet5000_urr.getDataRange().getValues()[0], [
            "email", "status", "login_id",
            "reset_token", "reset_expires", "reset_used_at", "reset_sent_at",
          ]);
          const vals5_urr = sheet5000_urr.getDataRange().getValues();
          const hdr5_urr  = vals5_urr[0];
          const idx5_urr  = indexMap_(hdr5_urr);
          const rows5_urr = vals5_urr.slice(1);
          for (let i = 0; i < rows5_urr.length; i++) {
            const loginId = str_(rows5_urr[i][idx5_urr["login_id"]]);
            const email   = str_(rows5_urr[i][idx5_urr["email"]]);
            if (id_urr === loginId || id_urr === email) {
              hitRow_urr = i + 2;
              targetSheet_urr = sheet5000_urr;
              targetIdx_urr   = idx5_urr;
              plan_urr        = "5000";
              break;
            }
          }
        }
      }
    }

    if (!hitRow_urr) return json_({ ok: true });

    const status_urr = str_(targetSheet_urr.getRange(hitRow_urr, targetIdx_urr["status"] + 1).getValue());
    if (status_urr !== "approved") return json_({ ok: true });

    const loginId_urr = str_(targetSheet_urr.getRange(hitRow_urr, targetIdx_urr["login_id"] + 1).getValue());
    const email_urr   = str_(targetSheet_urr.getRange(hitRow_urr, targetIdx_urr["email"]    + 1).getValue());
    if (!loginId_urr || !email_urr) return json_({ ok: true });

    const token_urr   = genResetToken_();
    const expires_urr = new Date(Date.now() + 72 * 60 * 60 * 1000);

    targetSheet_urr.getRange(hitRow_urr, targetIdx_urr["reset_token"]   + 1).setValue(token_urr);
    targetSheet_urr.getRange(hitRow_urr, targetIdx_urr["reset_expires"] + 1).setValue(expires_urr);
    targetSheet_urr.getRange(hitRow_urr, targetIdx_urr["reset_used_at"] + 1).setValue("");

    const myRefCode_urr = targetIdx_urr["my_ref_code"] !== undefined
      ? str_(targetSheet_urr.getRange(hitRow_urr, targetIdx_urr["my_ref_code"] + 1).getValue())
      : "";
    sendResetMail_(email_urr, loginId_urr, token_urr, myRefCode_urr, plan_urr);
    targetSheet_urr.getRange(hitRow_urr, targetIdx_urr["reset_sent_at"] + 1).setValue(new Date());

    return json_({ ok: true });
  }

  // =========================================================
  // me（ログイン情報 + 紹介コード情報を返す）
  // - Nextの /api/me から 叩く用の中継API対応
  // - login と同じ認証（approvedのみPW照合OK）
  // - approved: ok:true + me情報
  // - pending: ok:false reason:"pending"
  // - invalid: ok:false reason:"invalid"
  // ✅ 既存機能は削除しない、列は ensureCols_ で保証（壊さない）
  // =========================================================
  if (action === "me") {
    const id = str_(body.id);
    const code = str_(body.code);
    const group_me = str_(body.group);
    const targetSheet_me = group_me === "5000" ? getAppliesSheet5000_() : sheet;

    if (!id || !code) {
      return json_({ ok: false, reason: "invalid" });
    }

    let values = targetSheet_me.getDataRange().getValues();
    let header = values[0];

    // ✅ 必要列保証（壊さない）
    ensureCols_(targetSheet_me, header, [
      "login_id",
      "pw_hash",
      "email",
      "status",
      "plan",           // ✅ 追加: プランチェックに必要
      // 紹介系（今回の目的）
      "my_ref_code",
      "ref_path",
      "referrer_login_id",
      "referrer_2_login_id",
      "referrer_3_login_id",
    ]);

    values = targetSheet_me.getDataRange().getValues();
    header = values[0];

    const idx = indexMap_(header);
    const rows = values.slice(1);

    let hit = null;

    for (let i = 0; i < rows.length; i++) {
      const r = rows[i];
      const rowIndex = i + 2;

      const loginId = str_(r[idx["login_id"]]);
      const email = str_(r[idx["email"]]);

      // login と同仕様：login_id or email で一致
      if (id === loginId || id === email) {
        hit = { r: r, rowIndex: rowIndex };
        break;
      }
    }

    if (!hit) return json_({ ok: false, reason: "invalid" });

    // ✅ デバッグ: idx と hit.r の内容を確認（問題解消後に削除可）
    Logger.log("[me] idx: " + JSON.stringify(idx));
    Logger.log("[me] hit.r: " + JSON.stringify(hit.r));

    const status = str_(hit.r[idx["status"]]);
    if (status !== "approved") {
      // 承認前は情報を返さない（安全）
      return json_({ ok: false, reason: "pending" });
    }

    const loginId = str_(hit.r[idx["login_id"]]);
    const email = str_(hit.r[idx["email"]]);
    const pwHashSaved = str_(hit.r[idx["pw_hash"]]);

    if (!loginId || !pwHashSaved) return json_({ ok: false, reason: "invalid" });

    // PW照合（loginと同じ）
    const pwHashInput = hmacSha256Hex_(SECRET, loginId + ":" + code);
    if (pwHashInput !== pwHashSaved) return json_({ ok: false, reason: "invalid" });

    // ✅ 返すのは “必要最小限の公開情報” のみ（pw_hash等は返さない）
    return json_({
      ok: true,
      login_id: loginId,
      email: email,
      status: status,
      plan: str_(hit.r[idx["plan"]]),
      my_ref_code: str_(hit.r[idx["my_ref_code"]]),
      ref_path: str_(hit.r[idx["ref_path"]]),
      referrer_login_id: str_(hit.r[idx["referrer_login_id"]]),
      referrer_2_login_id: str_(hit.r[idx["referrer_2_login_id"]]),
      referrer_3_login_id: str_(hit.r[idx["referrer_3_login_id"]]),
    });
  }

  // =========================================================
  // my_referral_dashboard（自分が紹介した人リスト + 報酬履歴）
  // - me action と同じ認証（id + code の HMAC-SHA256 照合）
  // - approved のみデータを返す
  // =========================================================
  if (action === "my_referral_dashboard") {
    const id = str_(body.id);
    const code = str_(body.code);

    if (!id || !code) return json_({ ok: false, reason: "invalid" });

    // ✅ 必要列保証（壊さない）—— ensureCols_ の前に header_rd を取得
    let values_rd = sheet.getDataRange().getValues();
    let header_rd = values_rd[0];
    ensureCols_(sheet, header_rd, [
      "login_id",
      "pw_hash",
      "email",
      "status",
      "plan",
      "approved_at",
      "referrer_login_id",
      "my_ref_code",
    ]);
    // ensureCols_ 後に再取得（列追加があった場合に idx を最新化）
    values_rd = sheet.getDataRange().getValues();
    header_rd = values_rd[0];
    const idx_rd = indexMap_(header_rd);
    const rows_rd = values_rd.slice(1);

    // 認証（me と同じ）
    let myLoginId = "";
    let myRefCode = "";

    for (let i = 0; i < rows_rd.length; i++) {
      const r = rows_rd[i];
      const loginId = str_(r[idx_rd["login_id"]]);
      const email = str_(r[idx_rd["email"]]);
      if (id !== loginId && id !== email) continue;

      const status = str_(r[idx_rd["status"]]);
      if (status !== "approved") return json_({ ok: false, reason: "pending" });

      const pwHashSaved = str_(r[idx_rd["pw_hash"]]);
      if (!loginId || !pwHashSaved) return json_({ ok: false, reason: "invalid" });

      const pwHashInput = hmacSha256Hex_(SECRET, loginId + ":" + code);
      if (pwHashInput !== pwHashSaved) return json_({ ok: false, reason: "invalid" });

      myLoginId = loginId;
      myRefCode = str_(r[idx_rd["my_ref_code"]]);
      break;
    }

    if (!myLoginId) return json_({ ok: false, reason: "invalid" });

    // 自分が紹介した人（referrer_login_id == myLoginId かつ approved）を収集
    const referrals = [];
    for (let i = 0; i < rows_rd.length; i++) {
      const r = rows_rd[i];
      if (str_(r[idx_rd["referrer_login_id"]]) !== myLoginId) continue;
      const refLoginId = str_(r[idx_rd["login_id"]]);
      if (!refLoginId) continue;
      if (str_(r[idx_rd["status"]]) !== "approved") continue;
      const approvedAt = r[idx_rd["approved_at"]];
      referrals.push({
        login_id: refLoginId,
        plan: str_(r[idx_rd["plan"]]),
        approved_at: approvedAt ? new Date(approvedAt).toISOString() : "",
      });
    }

    // wallet_ledger からボーナス履歴取得
    const ss_rd = SpreadsheetApp.getActiveSpreadsheet();
    const ledger_rd = ss_rd.getSheetByName("wallet_ledger");
    const bonuses = [];
    let total_bonus = 0;

    if (ledger_rd) {
      const ledValues = getValuesSafe_(ledger_rd);
      if (ledValues.length >= 2) {
        const lHeader = ledValues[0];
        const lIdx = indexMap_(lHeader);
        const lRows = ledValues.slice(1);
        const BONUS_KINDS = ["referral_bonus", "referral_entry"];
        for (let i = 0; i < lRows.length; i++) {
          const r = lRows[i];
          const kind = str_(r[lIdx["kind"]]);
          const lid = str_(r[lIdx["login_id"]]);
          if (lid !== myLoginId) continue;
          if (!BONUS_KINDS.includes(kind)) continue;
          const amount = Number(r[lIdx["amount"]] || 0);
          const ts = r[lIdx["ts"]];
          bonuses.push({
            ts: ts ? new Date(ts).toISOString() : "",
            kind: kind,
            amount: amount,
            memo: str_(r[lIdx["memo"]]),
          });
          total_bonus += amount;
        }
      }
    }

    return json_({
      ok: true,
      my_ref_code: myRefCode,
      referrals: referrals,
      bonuses: bonuses,
      total_bonus: total_bonus,
    });
  }

  // =========================================================
  // login（approved/pending/invalid + pw_hash照合）
  // =========================================================
  if (action === "login") {
    const id = str_(body.id);
    const code = str_(body.code);
    const group_login = str_(body.group);

    if (!id || !code) {
      return json_({ ok: false, reason: "invalid" });
    }

    // group:"5000" のとき、メインシートを先に検索（新規5000ユーザー対応）
    // → 見つからなければ5000シートへフォールバック（既存ユーザー互換）
    let targetSheet_login = sheet;
    let foundIn5000Sheet = false;

    if (group_login === "5000") {
      const mainVals = sheet.getDataRange().getValues();
      const mainHdr  = mainVals[0];
      const mainIdx  = indexMap_(mainHdr);
      const mainRows = mainVals.slice(1);
      let foundInMain = false;
      for (let mi = 0; mi < mainRows.length; mi++) {
        const mLoginId = str_(mainRows[mi][mainIdx["login_id"]] !== undefined ? mainRows[mi][mainIdx["login_id"]] : "");
        const mEmail   = str_(mainRows[mi][mainIdx["email"]]    !== undefined ? mainRows[mi][mainIdx["email"]]    : "");
        if (id === mLoginId || id === mEmail) {
          foundInMain = true;
          break;
        }
      }
      if (!foundInMain) {
        targetSheet_login = getAppliesSheet5000_();
        foundIn5000Sheet  = true;
      }
    }

    let values = targetSheet_login.getDataRange().getValues();
    let header = values[0];

    // ✅ 必要列保証（壊さない）
    ensureCols_(targetSheet_login, header, ["login_id", "pw_hash", "email", "status"]);

    values = targetSheet_login.getDataRange().getValues();
    header = values[0];

    const idx = indexMap_(header);
    const rows = values.slice(1);

    let hit = null;

    for (let i = 0; i < rows.length; i++) {
      const r = rows[i];
      const rowIndex = i + 2;

      const loginId = str_(r[idx["login_id"]]);
      const email = str_(r[idx["email"]]);

      if (id === loginId || id === email) {
        hit = { r: r, rowIndex: rowIndex };
        break;
      }
    }

    if (!hit) return json_({ ok: false, reason: "invalid" });

    const status = str_(hit.r[idx["status"]]);
    if (status !== "approved") return json_({ ok: false, reason: "pending" });

    const loginId = str_(hit.r[idx["login_id"]]);
    const pwHashSaved = str_(hit.r[idx["pw_hash"]]);

    if (!loginId || !pwHashSaved) return json_({ ok: false, reason: "invalid" });

    let loginOk;
    if (foundIn5000Sheet) {
      // 既存5000ユーザー（5000シートにいる）は平文パスワードで照合
      loginOk = (code === pwHashSaved);
    } else {
      loginOk = (hmacSha256Hex_(SECRET, loginId + ":" + code) === pwHashSaved);
    }
    if (!loginOk) return json_({ ok: false, reason: "invalid" });

    return json_({ ok: true, group: (foundIn5000Sheet || group_login === "5000") ? "5000" : "" });
  }

  // =========================================================
  // reset_resend_5000（/5000: 認証メール再送）
  // =========================================================
  if (action === "reset_resend_5000") {
    const applyId_rr5 = str_(body.applyId);
    if (!applyId_rr5) return json_({ ok: false, error: "applyId required" });

    const ssId_rr5 = PropertiesService.getScriptProperties().getProperty("SPREADSHEET_5000_ID");
    if (!ssId_rr5) return json_({ ok: false, error: "SPREADSHEET_5000_ID not set" });

    const applySheet_rr5 = SpreadsheetApp.openById(ssId_rr5).getSheetByName("applies");
    if (!applySheet_rr5) return json_({ ok: false, error: "applies sheet not found" });

    let header_rr5 = applySheet_rr5.getDataRange().getValues()[0];
    ensureCols_(applySheet_rr5, header_rr5, [
      "apply_id", "status", "email", "login_id",
      "reset_token", "reset_expires", "reset_used_at", "reset_sent_at", "mail_error"
    ]);
    const lastCol_rr5 = applySheet_rr5.getLastColumn();
    header_rr5 = applySheet_rr5.getRange(1, 1, 1, lastCol_rr5).getValues()[0];
    const idx_rr5 = indexMap_(header_rr5);

    const allData_rr5 = applySheet_rr5.getDataRange().getValues();
    let targetRow_rr5 = -1;
    for (let ri = 1; ri < allData_rr5.length; ri++) {
      if (str_(allData_rr5[ri][idx_rr5["apply_id"]]) === applyId_rr5) {
        targetRow_rr5 = ri + 1;
        break;
      }
    }
    if (targetRow_rr5 < 0) return json_({ ok: false, error: "applyId not found" });

    // approved の行のみ再送可
    const status_rr5 = str_(applySheet_rr5.getRange(targetRow_rr5, idx_rr5["status"] + 1).getValue());
    if (status_rr5 !== "approved") {
      return json_({ ok: false, error: "not_approved" });
    }

    const email_rr5 = str_(applySheet_rr5.getRange(targetRow_rr5, idx_rr5["email"] + 1).getValue());
    const loginId_rr5 = str_(applySheet_rr5.getRange(targetRow_rr5, idx_rr5["login_id"] + 1).getValue());
    if (!email_rr5 || !loginId_rr5) return json_({ ok: false, error: "missing email or login_id" });

    // トークン再生成
    const newToken_rr5 = genResetToken_();
    const newExpires_rr5 = new Date(Date.now() + 72 * 60 * 60 * 1000);
    applySheet_rr5.getRange(targetRow_rr5, idx_rr5["reset_token"] + 1).setValue(newToken_rr5);
    applySheet_rr5.getRange(targetRow_rr5, idx_rr5["reset_expires"] + 1).setValue(newExpires_rr5);
    applySheet_rr5.getRange(targetRow_rr5, idx_rr5["reset_used_at"] + 1).setValue("");

    sendResetMail_(email_rr5, loginId_rr5, newToken_rr5, "", "5000");
    applySheet_rr5.getRange(targetRow_rr5, idx_rr5["reset_sent_at"] + 1).setValue(new Date());
    if (idx_rr5["mail_error"] !== undefined) {
      applySheet_rr5.getRange(targetRow_rr5, idx_rr5["mail_error"] + 1).setValue("");
    }

    return json_({ ok: true });
  }

  // =========================================================
  // get_apply_status_5000（/5000: 申請ステータス照会）
  // =========================================================
  if (action === "get_apply_status_5000") {
    const applyId_gs5 = str_(body.applyId);
    if (!applyId_gs5) return json_({ ok: false, error: "applyId required" });

    const ssId_gs5 = PropertiesService.getScriptProperties().getProperty("SPREADSHEET_5000_ID");
    if (!ssId_gs5) return json_({ ok: false, error: "SPREADSHEET_5000_ID not set" });

    const applySheet_gs5 = SpreadsheetApp.openById(ssId_gs5).getSheetByName("applies");
    if (!applySheet_gs5) return json_({ ok: false, error: "applies sheet not found" });

    const header_gs5 = applySheet_gs5.getDataRange().getValues()[0];
    const idx_gs5 = indexMap_(header_gs5);

    const allData_gs5 = applySheet_gs5.getDataRange().getValues();
    for (let ri = 1; ri < allData_gs5.length; ri++) {
      if (str_(allData_gs5[ri][idx_gs5["apply_id"]]) === applyId_gs5) {
        const row_gs5 = allData_gs5[ri];
        const status_gs5 = str_(row_gs5[idx_gs5["status"]]);
        const resetSentAt_gs5 = idx_gs5["reset_sent_at"] !== undefined ? row_gs5[idx_gs5["reset_sent_at"]] : "";
        return json_({
          ok: true,
          apply_id: applyId_gs5,
          status: status_gs5,
          payment_status: idx_gs5["payment_status"] !== undefined ? str_(row_gs5[idx_gs5["payment_status"]]) : "",
          plan: str_(row_gs5[idx_gs5["plan"]]),
          mail_sent: Boolean(resetSentAt_gs5)
        });
      }
    }
    return json_({ ok: false, error: "applyId not found" });
  }

  // =========================================================
  // payment_update_5000（/5000: IPN受信→シート更新→自動承認判定）
  // =========================================================
  if (action === "payment_update_5000") {
    const ssId_pu5 = PropertiesService.getScriptProperties().getProperty("SPREADSHEET_5000_ID");
    if (!ssId_pu5) return json_({ ok: false, error: "SPREADSHEET_5000_ID not set" });

    const ss_pu5 = SpreadsheetApp.openById(ssId_pu5);
    const applySheet_pu5 = ss_pu5.getSheetByName("applies");
    if (!applySheet_pu5) return json_({ ok: false, error: "applies sheet not found" });

    // 必要列を保証
    let header_pu5 = applySheet_pu5.getDataRange().getValues()[0];
    ensureCols_(applySheet_pu5, header_pu5, [
      "apply_id", "plan", "email", "status", "ref_id",
      "expected_paid", "payment_id", "payment_status", "actually_paid",
      "pay_currency", "paid_at", "approved_at", "last_ipn_at",
      "auto_approve_reason", "login_id", "pw_hash", "pw_updated_at",
      "reset_token", "reset_expires", "reset_used_at", "reset_sent_at",
      "my_ref_code", "mail_error", "referral_processed_at"
    ]);
    const lastCol_pu5 = applySheet_pu5.getLastColumn();
    header_pu5 = applySheet_pu5.getRange(1, 1, 1, lastCol_pu5).getValues()[0];
    const idx_pu5 = indexMap_(header_pu5);

    // apply_id で行を検索
    const applyId_pu5 = str_(body.applyId);
    if (!applyId_pu5) return json_({ ok: false, error: "applyId required" });

    const allData_pu5 = applySheet_pu5.getDataRange().getValues();
    let targetRow_pu5 = -1;
    for (let ri = 1; ri < allData_pu5.length; ri++) {
      if (str_(allData_pu5[ri][idx_pu5["apply_id"]]) === applyId_pu5) {
        targetRow_pu5 = ri + 1;
        break;
      }
    }
    if (targetRow_pu5 < 0) return json_({ ok: false, error: "applyId not found" });

    const paymentStatus_pu5 = str_(body.paymentStatus);
    const actuallyPaid_pu5 = Number(body.actuallyPaid) || 0;

    // payment_id / payment_status / actually_paid / pay_currency / last_ipn_at を更新
    if (idx_pu5["payment_id"] !== undefined && body.paymentId) {
      applySheet_pu5.getRange(targetRow_pu5, idx_pu5["payment_id"] + 1).setValue(str_(body.paymentId));
    }
    if (idx_pu5["payment_status"] !== undefined) {
      applySheet_pu5.getRange(targetRow_pu5, idx_pu5["payment_status"] + 1).setValue(paymentStatus_pu5);
    }
    if (idx_pu5["actually_paid"] !== undefined) {
      applySheet_pu5.getRange(targetRow_pu5, idx_pu5["actually_paid"] + 1).setValue(actuallyPaid_pu5);
    }
    if (idx_pu5["pay_currency"] !== undefined && body.payCurrency) {
      applySheet_pu5.getRange(targetRow_pu5, idx_pu5["pay_currency"] + 1).setValue(str_(body.payCurrency));
    }
    if (idx_pu5["last_ipn_at"] !== undefined) {
      applySheet_pu5.getRange(targetRow_pu5, idx_pu5["last_ipn_at"] + 1).setValue(new Date());
    }

    // NOWPayments status → /5000 内部 status マッピング
    const statusMap_pu5 = {
      "waiting": "payment_waiting",
      "confirming": "payment_confirming",
      "confirmed": "payment_confirmed",
      "partially_paid": "manual_review",
      "failed": "pending_error",
      "expired": "pending_error",
      "refunded": "pending_error"
    };

    let autoApproved_pu5 = false;
    let approveResult_pu5 = null;

    if (paymentStatus_pu5 === "finished") {
      // paid_at 記録
      if (idx_pu5["paid_at"] !== undefined) {
        applySheet_pu5.getRange(targetRow_pu5, idx_pu5["paid_at"] + 1).setValue(new Date());
      }

      // 金額チェック
      const expectedPaid_pu5 = Number(applySheet_pu5.getRange(targetRow_pu5, idx_pu5["expected_paid"] + 1).getValue()) || 0;
      const tolerance_pu5 = 0.02;

      if (expectedPaid_pu5 > 0 && actuallyPaid_pu5 >= expectedPaid_pu5 * (1 - tolerance_pu5)) {
        // 自動承認
        approveResult_pu5 = approveRowCore5000_(ss_pu5, applySheet_pu5, header_pu5, idx_pu5, targetRow_pu5, "payment_finished");
        if (approveResult_pu5.ok) {
          autoApproved_pu5 = true;
        }
      } else {
        // 金額不足
        applySheet_pu5.getRange(targetRow_pu5, idx_pu5["status"] + 1).setValue("manual_review");
        Logger.log("[payment_update_5000] amount insufficient: actually=" + actuallyPaid_pu5 + " expected=" + expectedPaid_pu5);
      }
    } else if (statusMap_pu5[paymentStatus_pu5]) {
      // approved_at が既にある（承認済み）なら status を上書きしない
      const approvedAt_pu5 = applySheet_pu5.getRange(targetRow_pu5, idx_pu5["approved_at"] + 1).getValue();
      if (!approvedAt_pu5) {
        applySheet_pu5.getRange(targetRow_pu5, idx_pu5["status"] + 1).setValue(statusMap_pu5[paymentStatus_pu5]);
      }
    }

    Logger.log("[payment_update_5000] applyId=" + applyId_pu5 + " paymentStatus=" + paymentStatus_pu5 + " autoApproved=" + autoApproved_pu5);
    return json_({
      ok: true,
      autoApproved: autoApproved_pu5,
      reason: autoApproved_pu5 ? "payment_finished" : (statusMap_pu5[paymentStatus_pu5] || paymentStatus_pu5),
      approveResult: approveResult_pu5
    });
  }

  // =========================================================
  // admin_list_5000（/5000スプレッドシートの申請一覧を返す）
  // =========================================================
  if (action === "admin_list_5000") {
    const adminKey_5000list = str_(body.adminKey);
    if (adminKey_5000list !== ADMIN_SECRET) {
      return json_({ ok: false, error: "forbidden" });
    }

    const ssId_list = PropertiesService.getScriptProperties().getProperty("SPREADSHEET_5000_ID");
    if (!ssId_list) return json_({ ok: false, error: "SPREADSHEET_5000_ID not set" });

    const ss5000_list = SpreadsheetApp.openById(ssId_list);
    const applySheet_list = ss5000_list.getSheetByName("applies");
    if (!applySheet_list) return json_({ ok: true, rows: [] });

    const allValues = applySheet_list.getDataRange().getValues();
    if (allValues.length < 2) return json_({ ok: true, rows: [] });

    const listHeader = allValues[0];
    const rows = allValues.slice(1).map(function(r, i) {
      var obj = {};
      listHeader.forEach(function(h, j) { obj[String(h)] = str_(r[j]); });
      obj["_rowIndex"] = i + 2;
      return obj;
    });

    return json_({ ok: true, rows: rows });
  }

  // =========================================================
  // admin_approve_5000（/5000申請を承認 + 紹介報酬計算）
  // =========================================================
  if (action === "admin_approve_5000") {
    const adminKey_5000 = str_(body.adminKey);
    if (adminKey_5000 !== ADMIN_SECRET) {
      return json_({ ok: false, error: "forbidden" });
    }

    const applyId_5000 = str_(body.applyId);
    if (!applyId_5000) return json_({ ok: false, error: "applyId required" });

    const ssId_5000 = PropertiesService.getScriptProperties().getProperty("SPREADSHEET_5000_ID");
    if (!ssId_5000) return json_({ ok: false, error: "SPREADSHEET_5000_ID not set" });

    const ss5000 = SpreadsheetApp.openById(ssId_5000);
    const applySheet_5000 = ss5000.getSheetByName("applies");
    if (!applySheet_5000) return json_({ ok: false, error: "applies sheet not found" });

    // 必要列を保証（壊さない）
    let header_5000 = applySheet_5000.getDataRange().getValues()[0];
    ensureCols_(applySheet_5000, header_5000, [
      "apply_id", "plan", "email", "name", "status", "ref_id",
      "login_id", "pw_hash", "pw_updated_at",
      "reset_token", "reset_expires", "reset_used_at", "reset_sent_at",
      "my_ref_code", "mail_error", "referral_processed_at",
      "approved_at", "auto_approve_reason", "expected_paid",
      "payment_id", "payment_status", "actually_paid", "pay_currency",
      "paid_at", "last_ipn_at"
    ]);
    const lastCol_5000 = applySheet_5000.getLastColumn();
    header_5000 = applySheet_5000.getRange(1, 1, 1, lastCol_5000).getValues()[0];
    const idx_5000 = indexMap_(header_5000);

    // applyId で行を検索
    const allData_5000 = applySheet_5000.getDataRange().getValues();
    let targetRow_5000 = -1;
    for (let ri = 1; ri < allData_5000.length; ri++) {
      if (str_(allData_5000[ri][idx_5000["apply_id"]]) === applyId_5000) {
        targetRow_5000 = ri + 1;
        break;
      }
    }
    if (targetRow_5000 < 0) return json_({ ok: false, error: "applyId not found" });

    const result_5000 = approveRowCore5000_(ss5000, applySheet_5000, header_5000, idx_5000, targetRow_5000, "admin_manual");
    return json_(result_5000);
  }

  // =========================================================
  // narasu代理申請 submit
  // =========================================================
  if (action === "narasu_agency_submit") {
    try {
      var narasuSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("narasu_agency");
      if (!narasuSheet) {
        narasuSheet = SpreadsheetApp.getActiveSpreadsheet().insertSheet("narasu_agency");
        narasuSheet.appendRow([
          "request_id", "created_at", "status",
          "narasu_login_id", "narasu_password",
          "audio_urls", "lyrics_text",
          "jacket_image_url", "jacket_note",
          "artist_name", "note",
          "agreed_terms_version", "agreed_at",
          "admin_memo"
        ]);
      }
      var requestId = "NA-" + Date.now();
      var now = new Date().toISOString();
      narasuSheet.appendRow([
        requestId,
        now,
        "submitted",
        str_(body.narasu_login_id),
        "[OMITTED]",
        str_(body.audio_urls),
        str_(body.lyrics_text),
        str_(body.jacket_image_url),
        str_(body.jacket_note),
        str_(body.artist_name),
        str_(body.note),
        str_(body.agreed_terms_version),
        str_(body.agreed_at),
        ""
      ]);
      // パスワードはシートに保存せず管理者メールのみに送信
      try {
        var adminEmail = PropertiesService.getScriptProperties().getProperty('ADMIN_EMAIL') || '';
        if (adminEmail) {
          MailApp.sendEmail(adminEmail,
            '[LIFAI] narasu申請 ' + requestId + ' ログイン情報',
            'requestId: ' + requestId + '\nloginId: ' + str_(body.narasu_login_id) + '\npassword: ' + str_(body.narasu_password));
        }
      } catch(mailErr) {
        Logger.log('[narasu_agency_submit] email送信失敗: ' + String(mailErr));
      }
      Logger.log("[narasu_agency_submit] saved: " + requestId);
      return json_({ ok: true, requestId: requestId });
    } catch (e) {
      Logger.log("[narasu_agency_submit] error: " + String(e));
      return json_({ ok: false, error: String(e) });
    }
  }

  // =========================================================
  // 楽曲売却申請（music_sell_submit / music_sell_list / music_sell_update）
  // =========================================================
  if (action === "music_sell_submit") {
    try {
      var loginId = str_(body.loginId);
      if (!loginId) return json_({ ok: false, error: "loginId_required" });
      var ss2 = SpreadsheetApp.getActiveSpreadsheet();
      var mss = ss2.getSheetByName("music_sell_requests");
      if (!mss) {
        mss = ss2.insertSheet("music_sell_requests");
        mss.appendRow(["request_id","login_id","title","music_url","price_usdt","memo","status","created_at"]);
      }
      var mRequestId = "MSR-" + Date.now();
      var mNow = new Date().toISOString();
      mss.appendRow([mRequestId, loginId, str_(body.title), str_(body.music_url),
                     str_(body.price_usdt), str_(body.memo), "pending", mNow]);
      return json_({ ok: true, requestId: mRequestId });
    } catch(e) {
      return json_({ ok: false, error: String(e) });
    }
  }

  if (action === "music_sell_list") {
    if (str_(body.adminKey) !== ADMIN_SECRET) return json_({ ok: false, error: "admin_unauthorized" });
    try {
      var ss3 = SpreadsheetApp.getActiveSpreadsheet();
      var mss2 = ss3.getSheetByName("music_sell_requests");
      if (!mss2) return json_({ ok: true, requests: [] });
      var mRows = mss2.getDataRange().getValues();
      var mHeaders = mRows[0];
      var mResult = mRows.slice(1).map(function(r) {
        var obj = {};
        mHeaders.forEach(function(h, i) { obj[h] = r[i]; });
        return obj;
      });
      return json_({ ok: true, requests: mResult });
    } catch(e) {
      return json_({ ok: false, error: String(e) });
    }
  }

  if (action === "music_sell_update") {
    if (str_(body.adminKey) !== ADMIN_SECRET) return json_({ ok: false, error: "admin_unauthorized" });
    try {
      var requestId2 = str_(body.requestId);
      var newStatus  = str_(body.status); // "approved" or "rejected"
      if (!requestId2 || !newStatus) return json_({ ok: false, error: "missing_params" });
      var ss4 = SpreadsheetApp.getActiveSpreadsheet();
      var mss3 = ss4.getSheetByName("music_sell_requests");
      if (!mss3) return json_({ ok: false, error: "sheet_not_found" });
      var mRows2    = mss3.getDataRange().getValues();
      var mHeaders2 = mRows2[0];
      var ridIdx    = mHeaders2.indexOf("request_id");
      var stIdx     = mHeaders2.indexOf("status");
      var liIdx     = mHeaders2.indexOf("login_id");
      var priceIdx  = mHeaders2.indexOf("price_usdt");
      var titleIdx  = mHeaders2.indexOf("title");
      var epGrantedIdx = mHeaders2.indexOf("ep_granted_at");

      for (var mi = 1; mi < mRows2.length; mi++) {
        if (str_(mRows2[mi][ridIdx]) === requestId2) {
          // 二重付与防止：既に approved なら何もしない
          if (str_(mRows2[mi][stIdx]) === "approved") {
            return json_({ ok: true, already: true });
          }

          mss3.getRange(mi + 1, stIdx + 1).setValue(newStatus);

          // approved 時のみ EP を付与
          if (newStatus === "approved") {
            var sellLoginId = str_(mRows2[mi][liIdx]);
            var epAmount    = Number(mRows2[mi][priceIdx] || 0);
            var sellTitle   = str_(mRows2[mi][titleIdx]);

            if (sellLoginId && epAmount > 0) {
              // applies シートのユーザー行を検索して ep_balance を加算
              var applySheet = ss4.getSheetByName("applies");
              if (applySheet) {
                var applyVals   = applySheet.getDataRange().getValues();
                var applyHeader = applyVals[0];
                ensureCols_(applySheet, applyHeader, ["login_id", "email", "ep_balance"]);
                applyVals   = applySheet.getDataRange().getValues();
                applyHeader = applyVals[0];
                var aIdx = indexMap_(applyHeader);
                var hitRow   = 0;
                var hitEmail = "";
                var currentEp = 0;
                for (var ai = 1; ai < applyVals.length; ai++) {
                  if (str_(applyVals[ai][aIdx["login_id"]]) === sellLoginId) {
                    hitRow    = ai + 1;
                    hitEmail  = str_(applyVals[ai][aIdx["email"]]);
                    currentEp = Number(applyVals[ai][aIdx["ep_balance"]] || 0);
                    break;
                  }
                }
                if (hitRow) {
                  var newEp = currentEp + epAmount;
                  applySheet.getRange(hitRow, aIdx["ep_balance"] + 1).setValue(newEp);
                  appendWalletLedger_({
                    kind:     "music_sell",
                    login_id: sellLoginId,
                    email:    hitEmail,
                    amount:   epAmount,
                    memo:     "楽曲売却承認EP（" + sellTitle + "）",
                  });
                  // ep_granted_at 列に記録（列がなければヘッダーを追加してから書き込む）
                  if (epGrantedIdx === -1) {
                    epGrantedIdx = mHeaders2.length;
                    mss3.getRange(1, epGrantedIdx + 1).setValue("ep_granted_at");
                  }
                  mss3.getRange(mi + 1, epGrantedIdx + 1).setValue(new Date().toISOString());
                  return json_({ ok: true, ep_granted: epAmount, ep_balance: newEp });
                }
              }
            }
          }

          return json_({ ok: true });
        }
      }
      return json_({ ok: false, error: "request_not_found" });
    } catch(e) {
      return json_({ ok: false, error: String(e) });
    }
  }

  // =========================================================
  // music_sell_notify（承認済み・未通知の売却申請をユーザーに返し、notified_at を記録）
  // =========================================================
  if (action === "music_sell_notify") {
    try {
      var notifyLoginId = str_(body.loginId);
      if (!notifyLoginId) return json_({ ok: false, error: "loginId_required" });
      var ss5 = SpreadsheetApp.getActiveSpreadsheet();
      var mss5 = ss5.getSheetByName("music_sell_requests");
      if (!mss5) return json_({ ok: true, items: [] });

      var nRows    = mss5.getDataRange().getValues();
      var nHeaders = nRows[0];
      var nLiIdx    = nHeaders.indexOf("login_id");
      var nStIdx    = nHeaders.indexOf("status");
      var nPriceIdx = nHeaders.indexOf("price_usdt");
      var nTitleIdx = nHeaders.indexOf("title");
      var nEpIdx    = nHeaders.indexOf("ep_granted_at");
      var nNotiIdx  = nHeaders.indexOf("notified_at");

      // notified_at 列がなければ追加
      if (nNotiIdx === -1) {
        mss5.getRange(1, nHeaders.length + 1).setValue("notified_at");
        nNotiIdx = nHeaders.length;
      }

      var items = [];
      for (var ni = 1; ni < nRows.length; ni++) {
        var rowLi    = str_(nRows[ni][nLiIdx]);
        var rowSt    = str_(nRows[ni][nStIdx]);
        var rowNoti  = nNotiIdx !== -1 ? str_(nRows[ni][nNotiIdx]) : "";
        var rowEpAt  = nEpIdx !== -1   ? str_(nRows[ni][nEpIdx])   : "";
        // 対象: 同ユーザー・approved・EP付与済み・未通知
        if (rowLi === notifyLoginId && rowSt === "approved" && rowEpAt && !rowNoti) {
          items.push({
            title:   str_(nRows[ni][nTitleIdx]),
            ep:      Number(nRows[ni][nPriceIdx] || 0),
          });
          // notified_at を記録
          mss5.getRange(ni + 1, nNotiIdx + 1).setValue(new Date().toISOString());
        }
      }
      return json_({ ok: true, items: items });
    } catch(e) {
      return json_({ ok: false, error: String(e) });
    }
  }

  // actionが不明
  return json_({ ok: false, error: "bad_action" });
}

// =========================================================
// ✅ /5000 承認コア（admin_approve_5000 と payment_update_5000 から共通利用）
// - approved_at が既に設定済み または status="approved" → already:true で早期リターン（冪等）
// - reason: "admin_manual" | "payment_finished" など
// =========================================================
function approveRowCore5000_(ss5000, applySheet, header, idx, rowIndex, reason) {
  // --- 冪等チェック ---
  const approvedAt5000 = applySheet.getRange(rowIndex, idx["approved_at"] + 1).getValue();
  const curStatus5000 = str_(applySheet.getRange(rowIndex, idx["status"] + 1).getValue());
  if (approvedAt5000 || curStatus5000 === "approved") {
    return {
      ok: true, already: true,
      loginId: str_(applySheet.getRange(rowIndex, idx["login_id"] + 1).getValue()),
      myRefCode: str_(applySheet.getRange(rowIndex, idx["my_ref_code"] + 1).getValue()),
      resetSent: true,
      referralResults: []
    };
  }

  const email5000 = str_(applySheet.getRange(rowIndex, idx["email"] + 1).getValue());
  if (!email5000) return { ok: false, error: "no_email" };

  // --- login_id 生成（未設定の場合のみ）---
  let loginId5000 = str_(applySheet.getRange(rowIndex, idx["login_id"] + 1).getValue());
  if (!loginId5000) {
    loginId5000 = "5k_" + randChars_(6);
    applySheet.getRange(rowIndex, idx["login_id"] + 1).setValue(loginId5000);
  }

  // --- my_ref_code 生成（未設定の場合のみ）---
  let myRefCode5000 = str_(applySheet.getRange(rowIndex, idx["my_ref_code"] + 1).getValue());
  if (!myRefCode5000) {
    myRefCode5000 = generateRefCode5000_(applySheet, idx);
    applySheet.getRange(rowIndex, idx["my_ref_code"] + 1).setValue(myRefCode5000);
  }

  // --- リセットトークン生成 ---
  const token5000 = genResetToken_();
  const expires5000 = new Date(Date.now() + 72 * 60 * 60 * 1000);
  applySheet.getRange(rowIndex, idx["reset_token"] + 1).setValue(token5000);
  applySheet.getRange(rowIndex, idx["reset_expires"] + 1).setValue(expires5000);
  applySheet.getRange(rowIndex, idx["reset_used_at"] + 1).setValue("");

  // --- メール送信（二重送信防止）---
  const sentAt5000 = applySheet.getRange(rowIndex, idx["reset_sent_at"] + 1).getValue();
  let resetSent5000 = false;
  if (!sentAt5000) {
    try {
      sendResetMail_(email5000, loginId5000, token5000, myRefCode5000, "5000");
      applySheet.getRange(rowIndex, idx["reset_sent_at"] + 1).setValue(new Date());
      if (idx["mail_error"] !== undefined) {
        applySheet.getRange(rowIndex, idx["mail_error"] + 1).setValue("");
      }
      resetSent5000 = true;
      Logger.log("[approveRowCore5000_] mail sent: to=" + email5000 + " reason=" + reason);
    } catch (mailErr) {
      const mailErrMsg = String(mailErr);
      Logger.log("[approveRowCore5000_] mail FAILED: " + mailErrMsg);
      if (idx["mail_error"] !== undefined) {
        applySheet.getRange(rowIndex, idx["mail_error"] + 1).setValue(mailErrMsg);
      }
      return { ok: false, error: "mail_failed: " + mailErrMsg };
    }
  } else {
    // メール送信済み（GAS実行中断の救済）
    resetSent5000 = true;
  }

  // --- approved_at 記録 + status 更新 ---
  applySheet.getRange(rowIndex, idx["approved_at"] + 1).setValue(new Date());
  applySheet.getRange(rowIndex, idx["status"] + 1).setValue("approved");
  if (idx["auto_approve_reason"] !== undefined) {
    applySheet.getRange(rowIndex, idx["auto_approve_reason"] + 1).setValue(reason);
  }

  // --- 紹介チェーン遡り（最大5段・二重記録防止）---
  const referralAlreadyProcessed5000 = applySheet.getRange(rowIndex, idx["referral_processed_at"] + 1).getValue();
  const referralResults5000 = [];

  if (!referralAlreadyProcessed5000) {
    const planStr5000 = str_(applySheet.getRange(rowIndex, idx["plan"] + 1).getValue());
    const planAmountMap5000 = { "500": 500, "2000": 2000, "3000": 3000, "5000": 5000 };
    const entryAmount5000 = planAmountMap5000[planStr5000] || 0;
    const refRates5000 = [0.10, 0.05, 0.02, 0.02, 0.01];
    const yearMonth5000 = Utilities.formatDate(new Date(), "Asia/Tokyo", "yyyy_MM");
    const ledgerSheet5000 = getLedgerSheet5000_(ss5000, yearMonth5000);

    const applyId5000 = str_(applySheet.getRange(rowIndex, idx["apply_id"] + 1).getValue());
    let currentRefCode5000 = str_(applySheet.getRange(rowIndex, idx["ref_id"] + 1).getValue());

    for (var lvl = 1; lvl <= 5 && currentRefCode5000; lvl++) {
      const chainData = applySheet.getDataRange().getValues();
      var referrerLoginId5000 = "";
      var referrerRefId5000 = "";
      for (var ci = 1; ci < chainData.length; ci++) {
        if (str_(chainData[ci][idx["my_ref_code"]]) === currentRefCode5000) {
          referrerLoginId5000 = str_(chainData[ci][idx["login_id"]]);
          referrerRefId5000 = str_(chainData[ci][idx["ref_id"]]);
          break;
        }
      }
      if (!referrerLoginId5000) break;
      if (entryAmount5000 > 0) {
        const rate5000 = refRates5000[lvl - 1];
        const commission5000 = Math.round(entryAmount5000 * rate5000 * 100) / 100;
        const levelSuffix = lvl === 1 ? "st" : lvl === 2 ? "nd" : lvl === 3 ? "rd" : "th";
        ledgerSheet5000.appendRow([
          new Date(), referrerLoginId5000, "referral_entry",
          commission5000, applyId5000, lvl,
          "$" + entryAmount5000 + " plan " + lvl + levelSuffix + " level " + Math.round(rate5000 * 100) + "%"
        ]);
        referralResults5000.push({ level: lvl, to: referrerLoginId5000, amount: commission5000 });
      }
      currentRefCode5000 = referrerRefId5000;
    }
    applySheet.getRange(rowIndex, idx["referral_processed_at"] + 1).setValue(new Date());
  }

  // ============================================================
  // メインシートへの書き込み（新規管理方針：entry_source="5000"）
  // 冪等性のため login_id で重複チェックを行う
  // ============================================================
  try {
    const mainSheet = getOrCreateSheet_();

    // 必要列を保証
    const mainHeaderRaw = mainSheet.getDataRange().getValues()[0];
    ensureCols_(mainSheet, mainHeaderRaw, [
      "created_at", "apply_id", "plan", "email", "name", "name_kana",
      "age_band", "prefecture", "city", "job", "ref_name", "ref_id",
      "status", "approved_at", "login_id", "my_ref_code",
      "reset_token", "reset_expires", "reset_used_at", "reset_sent_at",
      "bp_balance", "ep_balance", "bp_granted_at", "bp_grant_plan",
      "bp_grant_amount", "ep_grant_amount",
      "entry_source",
    ]);

    const mainHeader2 = mainSheet.getDataRange().getValues()[0];
    const mainIdx2    = indexMap_(mainHeader2);
    const mainData2   = mainSheet.getDataRange().getValues().slice(1);

    // 重複チェック（login_id が既にある場合はスキップ）
    let alreadyInMain = false;
    for (let di = 0; di < mainData2.length; di++) {
      if (str_(mainData2[di][mainIdx2["login_id"]]) === loginId5000) {
        alreadyInMain = true;
        break;
      }
    }

    if (!alreadyInMain) {
      // 5000ルートのプラン別BP付与量
      const bpMap5000Route = { "500": 1000, "2000": 4000, "3000": 8000, "5000": 10000 };
      const planStr5k = str_(applySheet.getRange(rowIndex, idx["plan"] + 1).getValue());
      const bpGrant5k = bpMap5000Route[planStr5k] || 0;

      const newRow = new Array(mainHeader2.length).fill("");
      newRow[mainIdx2["created_at"]]      = new Date();
      newRow[mainIdx2["apply_id"]]        = str_(applySheet.getRange(rowIndex, idx["apply_id"]   + 1).getValue());
      newRow[mainIdx2["plan"]]            = planStr5k;
      newRow[mainIdx2["email"]]           = email5000;
      newRow[mainIdx2["name"]]            = str_(applySheet.getRange(rowIndex, idx["name"]        + 1).getValue());
      newRow[mainIdx2["name_kana"]]       = str_(applySheet.getRange(rowIndex, idx["name_kana"]   + 1).getValue());
      newRow[mainIdx2["age_band"]]        = str_(applySheet.getRange(rowIndex, idx["age_band"]    + 1).getValue());
      newRow[mainIdx2["prefecture"]]      = str_(applySheet.getRange(rowIndex, idx["prefecture"]  + 1).getValue());
      newRow[mainIdx2["city"]]            = str_(applySheet.getRange(rowIndex, idx["city"]        + 1).getValue());
      newRow[mainIdx2["job"]]             = str_(applySheet.getRange(rowIndex, idx["job"]         + 1).getValue());
      newRow[mainIdx2["ref_name"]]        = str_(applySheet.getRange(rowIndex, idx["ref_name"]    + 1).getValue());
      newRow[mainIdx2["ref_id"]]          = str_(applySheet.getRange(rowIndex, idx["ref_id"]      + 1).getValue());
      newRow[mainIdx2["status"]]          = "approved";
      newRow[mainIdx2["approved_at"]]     = new Date();
      newRow[mainIdx2["login_id"]]        = loginId5000;
      newRow[mainIdx2["my_ref_code"]]     = myRefCode5000;
      newRow[mainIdx2["reset_token"]]     = token5000;
      newRow[mainIdx2["reset_expires"]]   = expires5000;
      newRow[mainIdx2["reset_used_at"]]   = "";
      newRow[mainIdx2["reset_sent_at"]]   = sentAt5000 ? sentAt5000 : "";
      newRow[mainIdx2["bp_balance"]]      = bpGrant5k;
      newRow[mainIdx2["ep_balance"]]      = 0;
      newRow[mainIdx2["bp_granted_at"]]   = new Date();
      newRow[mainIdx2["bp_grant_plan"]]   = planStr5k;
      newRow[mainIdx2["bp_grant_amount"]] = bpGrant5k;
      newRow[mainIdx2["ep_grant_amount"]] = 0;
      newRow[mainIdx2["entry_source"]]    = "5000";
      mainSheet.appendRow(newRow);
      Logger.log("[approveRowCore5000_] written to main applies: loginId=" + loginId5000);
    } else {
      Logger.log("[approveRowCore5000_] skip: loginId=" + loginId5000 + " already in main applies");
    }
  } catch (mainWriteErr) {
    // メインシート書き込み失敗はログのみ（5000シートの承認自体は成功扱い）
    Logger.log("[approveRowCore5000_] main sheet write error: " + String(mainWriteErr));
  }

  return {
    ok: true, already: false,
    loginId: loginId5000,
    myRefCode: myRefCode5000,
    resetSent: resetSent5000,
    referralResults: referralResults5000
  };
}

// ==============================
// ✅ 承認コア（admin_approve と payment_update から共通利用）
// - 既存構造を壊さず、admin_approve の中身を集約
// - 返り値：admin_approve の従来返り値に合わせる（壊さない）
// ==============================

function approveRowCore_(sheet, header, idx, rowIndex, note) {
  try {
    // ✅ 必要列保証（壊さない）
    ensureCols_(sheet, header, [
      "email",
      "status",
      "login_id",
      "pw_hash",
      "pw_updated_at",
      "reset_token",
      "reset_expires",
      "reset_used_at",
      "reset_sent_at",

      // ✅ 紹介コード（壊さない）
      "my_ref_code",
      "ref_code",
      "referrer_login_id",
      "referrer_2_login_id",
      "referrer_3_login_id",
      "referrer_4_login_id",   // 5段拡張
      "referrer_5_login_id",   // 5段拡張
      "ref_path",
      "affiliate_granted_at",  // 将来の自動付与用冪等ガード

      // ✅ BP/EP付与（今回追加：壊さない）
      "bp_balance",
      "ep_balance",
      "bp_granted_at",
      "bp_grant_plan",
      "bp_grant_amount",
      "ep_grant_amount",

      // ✅ 紹介配当（今回追加：壊さない）
      "ref_share_pct",
      "ref_bonus_granted_at",
      "ref_bonus_amount",
      "expected_paid",
      "plan",

      // ✅ メールエラーログ（デバッグ用）
      "mail_error",

      // ✅ 入口識別（5000ルートから入ったユーザーに "5000" を設定）
      "entry_source",
    ]);

    // ✅ ensureCols_ で列が増えた可能性があるので header/idx を再生成（壊さない）
    try {
      const lastCol = sheet.getLastColumn();
      if (lastCol && lastCol > 0) {
        const h2 = sheet.getRange(1, 1, 1, lastCol).getValues();
        header = (h2 && h2[0]) ? h2[0] : header;
        idx = indexMap_(header);
      }
    } catch (e) {}

    const email = str_(sheet.getRange(rowIndex, idx["email"] + 1).getValue());
    if (!email) return { ok: false, error: "no_email" };

    // approved済みの場合の処理（壊さない）
    const curStatus = str_(sheet.getRange(rowIndex, idx["status"] + 1).getValue());
    if (curStatus === "approved") {
      const existingLoginId = str_(sheet.getRange(rowIndex, idx["login_id"] + 1).getValue());
      const existingMyRefCode = str_(sheet.getRange(rowIndex, idx["my_ref_code"] + 1).getValue());
      const sentAt = sheet.getRange(rowIndex, idx["reset_sent_at"] + 1).getValue();
      const pwHash = idx["pw_hash"] !== undefined ? str_(sheet.getRange(rowIndex, idx["pw_hash"] + 1).getValue()) : "";

      // ✅ Bug Fix: approved済みだがメール未送信かつパスワード未設定 → トークン再発行してメール再送
      // （auto_approveでstatus=approvedになった後にsendResetMail_が失敗した場合の救済）
      if (!sentAt && !pwHash && existingLoginId) {
        const newToken = genResetToken_();
        const newExpires = new Date(Date.now() + 72 * 60 * 60 * 1000);
        sheet.getRange(rowIndex, idx["reset_token"] + 1).setValue(newToken);
        sheet.getRange(rowIndex, idx["reset_expires"] + 1).setValue(newExpires);
        sheet.getRange(rowIndex, idx["reset_used_at"] + 1).setValue("");
        Logger.log("[approveRowCore_/already_approved] resending mail: to=" + email + " loginId=" + existingLoginId);
        // MailApp エラーはここで throw → outer catch で { ok: false, error } が返る
        sendResetMail_(email, existingLoginId, newToken, existingMyRefCode);
        sheet.getRange(rowIndex, idx["reset_sent_at"] + 1).setValue(new Date());
        if (idx["mail_error"] !== undefined) sheet.getRange(rowIndex, idx["mail_error"] + 1).setValue("");
        Logger.log("[approveRowCore_/already_approved] mail sent OK: to=" + email);
        return {
          ok: true,
          loginId: existingLoginId || "",
          resetSent: true,
          myRefCode: existingMyRefCode || "",
          refBound: !!str_(sheet.getRange(rowIndex, idx["referrer_login_id"] + 1).getValue()),
          bpGranted: !!sheet.getRange(rowIndex, idx["bp_granted_at"] + 1).getValue(),
          bpAdded: 0,
          epAdded: 0,
          refBonusGranted: !!sheet.getRange(rowIndex, idx["ref_bonus_granted_at"] + 1).getValue(),
          refBonusAmount: parseMoneyLike_(sheet.getRange(rowIndex, idx["ref_bonus_amount"] + 1).getValue()),
        };
      }

      return {
        ok: true,
        loginId: existingLoginId || "",
        resetSent: !!sentAt,
        myRefCode: existingMyRefCode || "",
        refBound: !!str_(sheet.getRange(rowIndex, idx["referrer_login_id"] + 1).getValue()),
        bpGranted: !!sheet.getRange(rowIndex, idx["bp_granted_at"] + 1).getValue(),
        bpAdded: 0,
        epAdded: 0,
        refBonusGranted: !!sheet.getRange(rowIndex, idx["ref_bonus_granted_at"] + 1).getValue(),
        refBonusAmount: parseMoneyLike_(sheet.getRange(rowIndex, idx["ref_bonus_amount"] + 1).getValue()),
      };
    }

    // ✅ INVARIANT: login_id は一度発行したら絶対に上書きしない。
    // パスワードリセット・再承認・メール再送のいずれでも loginId は変わらない。
    // 既存の login_id がある場合は読み取るだけで setValue は呼ばない。
    // login ID生成（既存仕様を維持）
    let loginId = str_(sheet.getRange(rowIndex, idx["login_id"] + 1).getValue());
    if (!loginId) {
      loginId = genLoginId_();
      sheet.getRange(rowIndex, idx["login_id"] + 1).setValue(loginId);
    }

    // ✅ 本人の紹介コードを発行（R-login_id：復元可能で安全）
    let myRefCode = str_(sheet.getRange(rowIndex, idx["my_ref_code"] + 1).getValue());
    if (!myRefCode) {
      myRefCode = "R-" + loginId;
      sheet.getRange(rowIndex, idx["my_ref_code"] + 1).setValue(myRefCode);
    }

    // ✅ 入力された紹介コードから、最大5段の紹介者を確定（5段拡張・壊さない）
    const usedRefCode = str_(sheet.getRange(rowIndex, idx["ref_code"] + 1).getValue());
    const bind = resolveRefChain_(sheet, header, usedRefCode);

    if (bind && bind.ref1_login_id) {
      sheet.getRange(rowIndex, idx["referrer_login_id"] + 1).setValue(bind.ref1_login_id);
      sheet.getRange(rowIndex, idx["referrer_2_login_id"] + 1).setValue(bind.ref2_login_id || "");
      sheet.getRange(rowIndex, idx["referrer_3_login_id"] + 1).setValue(bind.ref3_login_id || "");
      if (idx["referrer_4_login_id"] !== undefined) {
        sheet.getRange(rowIndex, idx["referrer_4_login_id"] + 1).setValue(bind.ref4_login_id || "");
      }
      if (idx["referrer_5_login_id"] !== undefined) {
        sheet.getRange(rowIndex, idx["referrer_5_login_id"] + 1).setValue(bind.ref5_login_id || "");
      }

      const path =
        (bind.ref1_login_id                    ? bind.ref1_login_id                           : "") +
        (bind.ref2_login_id                    ? " > " + bind.ref2_login_id                   : "") +
        (bind.ref3_login_id                    ? " > " + bind.ref3_login_id                   : "") +
        ((bind.ref4_login_id || "")            ? " > " + (bind.ref4_login_id || "")           : "") +
        ((bind.ref5_login_id || "")            ? " > " + (bind.ref5_login_id || "")           : "");
      sheet.getRange(rowIndex, idx["ref_path"] + 1).setValue(path);
    } else {
      // 紹介コードが無い/無効ならクリア（壊さない）
      sheet.getRange(rowIndex, idx["referrer_login_id"] + 1).setValue("");
      sheet.getRange(rowIndex, idx["referrer_2_login_id"] + 1).setValue("");
      sheet.getRange(rowIndex, idx["referrer_3_login_id"] + 1).setValue("");
      if (idx["referrer_4_login_id"] !== undefined) {
        sheet.getRange(rowIndex, idx["referrer_4_login_id"] + 1).setValue("");
      }
      if (idx["referrer_5_login_id"] !== undefined) {
        sheet.getRange(rowIndex, idx["referrer_5_login_id"] + 1).setValue("");
      }
      sheet.getRange(rowIndex, idx["ref_path"] + 1).setValue("");
    }

    // ✅ ref_events に記録（監査用）
    appendRefEvent_({
      new_login_id: loginId,
      new_email: email,
      used_ref_code: usedRefCode,
      ref1_login_id: bind ? bind.ref1_login_id : "",
      ref2_login_id: bind ? bind.ref2_login_id : "",
      ref3_login_id: bind ? bind.ref3_login_id : "",
      note: note || "approveRowCore_",
    });

    // RESET TOKEN生成（30分）
    const token = genResetToken_();
    const expires = new Date(Date.now() + 72 * 60 * 60 * 1000);

    sheet.getRange(rowIndex, idx["reset_token"] + 1).setValue(token);
    sheet.getRange(rowIndex, idx["reset_expires"] + 1).setValue(expires);
    sheet.getRange(rowIndex, idx["reset_used_at"] + 1).setValue("");
    sheet.getRange(rowIndex, idx["status"] + 1).setValue("approved");

    // ✅ approved になった瞬間にBP/EPを付与（bp_granted_at で二重付与防止）（壊さない）
    let bpGranted = false;
    let bpAdded = 0;
    let epAdded = 0;

    try {
      const grantedAt = sheet.getRange(rowIndex, idx["bp_granted_at"] + 1).getValue();
      if (!grantedAt) {
        // plan を見て付与量を決める（価格は気にしない / 画像のポイント表に合わせる）
        const plan = str_(sheet.getRange(rowIndex, idx["plan"] + 1).getValue());
        const g = planToGrant_(plan);

        const curBp = Number(sheet.getRange(rowIndex, idx["bp_balance"] + 1).getValue() || 0);
        const curEp = Number(sheet.getRange(rowIndex, idx["ep_balance"] + 1).getValue() || 0);

        const nextBp = (Number.isFinite(curBp) ? curBp : 0) + (Number.isFinite(g.bp) ? g.bp : 0);
        const nextEp = (Number.isFinite(curEp) ? curEp : 0) + (Number.isFinite(g.ep) ? g.ep : 0);

        sheet.getRange(rowIndex, idx["bp_balance"] + 1).setValue(nextBp);
        sheet.getRange(rowIndex, idx["ep_balance"] + 1).setValue(nextEp);

        sheet.getRange(rowIndex, idx["bp_granted_at"] + 1).setValue(new Date());
        sheet.getRange(rowIndex, idx["bp_grant_plan"] + 1).setValue(plan);
        sheet.getRange(rowIndex, idx["bp_grant_amount"] + 1).setValue(Number.isFinite(g.bp) ? g.bp : 0);
        sheet.getRange(rowIndex, idx["ep_grant_amount"] + 1).setValue(Number.isFinite(g.ep) ? g.ep : 0);

        bpGranted = true;
        bpAdded = Number.isFinite(g.bp) ? g.bp : 0;
        epAdded = Number.isFinite(g.ep) ? g.ep : 0;
      } else {
        bpGranted = true;
        bpAdded = 0;
        epAdded = 0;
      }
    } catch (e) {}

    // ✅ 紹介配当を付与（1段のみ / plan額基準 / ref_bonus_granted_at で二重付与防止）（壊さない）
    let refBonusGranted = false;
    let refBonusAmount = 0;

    try {
      const already = sheet.getRange(rowIndex, idx["ref_bonus_granted_at"] + 1).getValue();
      if (!already) {
        const expectedCell = sheet.getRange(rowIndex, idx["expected_paid"] + 1).getValue();
        let expected = parseMoneyLike_(expectedCell);
        if (!expected || !Number.isFinite(expected) || expected <= 0) {
          const p3 = str_(sheet.getRange(rowIndex, idx["plan"] + 1).getValue());
          const exp3 = planToExpectedPaid_(p3);
          if (exp3 > 0) expected = exp3;
        }
        const childRef1 = str_(sheet.getRange(rowIndex, idx["referrer_login_id"] + 1).getValue());

        if (childRef1 && expected > 0) {
          const granted = grantReferralBonusOnce_(sheet, header, idx, rowIndex, expected, note || "approveRowCore_");
          refBonusGranted = !!(granted && granted.ok);
          refBonusAmount = granted && granted.amount ? Number(granted.amount) : 0;
        } else {
          refBonusGranted = false;
          refBonusAmount = 0;
        }
      } else {
        refBonusGranted = true;
        refBonusAmount = parseMoneyLike_(sheet.getRange(rowIndex, idx["ref_bonus_amount"] + 1).getValue());
      }
    } catch (e) {}

    // メール送信（reset_sent_at があれば送らない：二重送信防止）
    const sentAt = sheet.getRange(rowIndex, idx["reset_sent_at"] + 1).getValue();
    let resetSent = false;
    if (!sentAt) {
      Logger.log("[approveRowCore_] sending mail: to=" + email + " loginId=" + loginId + " note=" + note);
      try {
        sendResetMail_(email, loginId, token, myRefCode);
        sheet.getRange(rowIndex, idx["reset_sent_at"] + 1).setValue(new Date());
        if (idx["mail_error"] !== undefined) sheet.getRange(rowIndex, idx["mail_error"] + 1).setValue("");
        resetSent = true;
        Logger.log("[approveRowCore_] mail sent OK: to=" + email);
      } catch (mailErr) {
        const mailErrMsg = String(mailErr);
        Logger.log("[approveRowCore_] mail FAILED: " + mailErrMsg + " to=" + email);
        if (idx["mail_error"] !== undefined) sheet.getRange(rowIndex, idx["mail_error"] + 1).setValue(mailErrMsg);
        // rethrow して outer catch で { ok: false, error } を返す
        throw mailErr;
      }
    } else {
      resetSent = true;
    }

    return {
      ok: true,
      loginId: loginId,
      resetSent: resetSent,
      myRefCode: myRefCode,
      refBound: !!(bind && bind.ref1_login_id),
      bpGranted: bpGranted,
      bpAdded: bpAdded,
      epAdded: epAdded,
      refBonusGranted: refBonusGranted,
      refBonusAmount: refBonusAmount,
    };
  } catch (e) {
    return { ok: false, error: String(e) };
  }
}

// ==============================
// ✅ 紹介配当（今回追加：壊さない）
// - 1段のみ（child.referrer_login_id）
// - 基準金額：plan額（expected_paid）
// - referrer の ref_share_pct（20 or 40）を参照（手動入力）
// - wallet_ledger に記録し、child.ref_bonus_* にも記録（二重付与防止）
// ==============================

function grantReferralBonusOnce_(sheet, header, idx, childRowIndex, expectedPaid, note) {
  try {
    // 必要列保証（壊さない）
    ensureCols_(sheet, header, [
      "login_id",
      "email",
      "status",
      "plan",
      "expected_paid",
      "referrer_login_id",
      "ref_share_pct",
      "ref_bonus_granted_at",
      "ref_bonus_amount",
    ]);

    // header/idx 再生成（壊さない）
    try {
      const lastCol = sheet.getLastColumn();
      if (lastCol && lastCol > 0) {
        const h2 = sheet.getRange(1, 1, 1, lastCol).getValues();
        header = (h2 && h2[0]) ? h2[0] : header;
        idx = indexMap_(header);
      }
    } catch (e) {}

    const already = sheet.getRange(childRowIndex, idx["ref_bonus_granted_at"] + 1).getValue();
    if (already) {
      return { ok: true, already: true, amount: parseMoneyLike_(sheet.getRange(childRowIndex, idx["ref_bonus_amount"] + 1).getValue()) };
    }

    const childStatus = str_(sheet.getRange(childRowIndex, idx["status"] + 1).getValue());
    if (childStatus !== "approved" && childStatus !== "paid") {
      return { ok: false, error: "child_not_approved" };
    }

    const ref1 = str_(sheet.getRange(childRowIndex, idx["referrer_login_id"] + 1).getValue());
    if (!ref1) {
      return { ok: false, error: "no_referrer" };
    }

    // referrer 行を探す（login_id一致）
    const values = getValuesSafe_(sheet);
    const h = values[0];
    const im = indexMap_(h);
    const rows = values.slice(1);

    if (im["login_id"] === undefined) return { ok: false, error: "missing_login_id_col" };
    if (im["ref_share_pct"] === undefined) return { ok: false, error: "missing_ref_share_pct_col" };

    let refRowIndex = 0;
    let refSharePct = 0;
    let refEmail = "";
    for (let i = 0; i < rows.length; i++) {
      const r = rows[i];
      const loginId = str_(r[im["login_id"]]);
      if (loginId && loginId === ref1) {
        refRowIndex = i + 2;
        refSharePct = parseMoneyLike_(r[im["ref_share_pct"]]);
        refEmail = im["email"] !== undefined ? str_(r[im["email"]]) : "";
        break;
      }
    }

    if (!refRowIndex) {
      return { ok: false, error: "referrer_not_found" };
    }

    const pctOk = refSharePct === 20 || refSharePct === 40;
    if (!pctOk) {
      return { ok: false, error: "ref_share_pct_invalid" };
    }

    const base = Number(expectedPaid || 0);
    if (!Number.isFinite(base) || base <= 0) {
      return { ok: false, error: "bad_expected_paid" };
    }

    const amount = base * (refSharePct / 100);

    // wallet_ledger に追記（壊さない）
    try {
      appendWalletLedger_({
        ts: new Date(),
        kind: "referral_bonus",
        login_id: ref1,
        email: refEmail,
        amount: amount,
        memo: "childRow=" + String(childRowIndex) + " base=" + String(base) + " pct=" + String(refSharePct) + " note=" + str_(note),
      });
    } catch (e) {}

    // child 側に付与済みを刻む（壊さない）
    sheet.getRange(childRowIndex, idx["ref_bonus_amount"] + 1).setValue(amount);
    sheet.getRange(childRowIndex, idx["ref_bonus_granted_at"] + 1).setValue(new Date());

    return { ok: true, amount: amount, pct: refSharePct, referrer: ref1 };
  } catch (e) {
    return { ok: false, error: String(e) };
  }
}

function getOrCreateRadioSongsSheet_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  return getOrCreateSheetByName_(ss, "radio_songs", [
    "song_id",
    "title",
    "artist",
    "service_links",
    "thumbnail_url",
    "active",
    "created_at",
  ]);
}

function getOrCreateRadioMissionsSheet_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  return getOrCreateSheetByName_(ss, "radio_missions", [
    "mission_id",
    "login_id",
    "song_id",
    "started_at",
    "submitted_at",
    "status",
    "ep_granted",
    "screenshot_note",
  ]);
}

function getOrCreateStakingSheet_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  return getOrCreateSheetByName_(ss, "staking", [
    "stake_id",
    "login_id",
    "staked_bp",
    "rate",
    "started_at",
    "expires_at",
    "status",
    "claimed_at",
    "interest_bp",
    "total_bp",
  ]);
}

function appendWalletLedger_(o) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const led = getOrCreateSheetByName_(ss, "wallet_ledger", [
    "ts",
    "kind",
    "login_id",
    "email",
    "amount",
    "memo",
  ]);

  led.appendRow([
    o.ts ? o.ts : new Date(),
    str_(o.kind),
    str_(o.login_id),
    str_(o.email),
    Number(o.amount || 0),
    str_(o.memo),
  ]);
}

// ==============================
// ✅ Plan -> expected_paid（今回追加：壊さない）
// - plan が数値ならそのまま採用
// - 文字列プランでも最低限対応できるように保険
// - 期待金額が不明なら 0 を返す（payment_update側で pending_error に落とす）
// ==============================

function planToExpectedPaid_(plan) {
  const p = str_(plan).trim();

  // 数値っぽいならそのまま（例："34" / "2000" / 34）
  const n = parseMoneyLike_(p);
  if (Number.isFinite(n) && n > 0) return n;

  // 文字列プランの保険（必要ならここに足すだけで壊れない）
  // 例： "plan_34" / "basic_34" などに対応したい場合
  // 今は不明なので 0 を返す（壊さない）
  return 0;
}

// ==============================
// ✅ Plan -> BP/EP付与（今回追加：壊さない）
// - 価格は気にしない / 画像のポイント表に合わせる
// - plan が数値（34/57/114/567/1134）なら対応
// - 不明なら 0 を返す（壊さない）
// ==============================

function planToGrant_(plan) {
  const p = str_(plan).trim();
  const n = parseMoneyLike_(p);

  // 画像のポイント表（固定）
  // Starter 34 USDT -> 300BP付与
  // Builder 57 USDT -> 600BP付与
  // Automation 114 USDT -> 1200BP付与
  // Core 567 USDT -> 6000BP付与
  // Infra 1,134 USDT -> 12000BP付与
  if (Number.isFinite(n)) {
    if (n === 34) return { bp: 300, ep: 0 };
    if (n === 57) return { bp: 600, ep: 0 };
    if (n === 114) return { bp: 1200, ep: 0 };
    if (n === 567) return { bp: 6000, ep: 0 };
    if (n === 1134) return { bp: 12000, ep: 0 };
  }

  return { bp: 0, ep: 0 };
}

// ==============================
// ✅ 金額っぽい文字列を数値化（今回追加：壊さない）
// - "34" / "34.00" / "1,234.56" / "USDT 34" 等を許容
// ==============================

function parseMoneyLike_(v) {
  if (v === undefined || v === null) return 0;
  const s = String(v).trim();
  if (!s) return 0;

  // 数字/小数点/カンマ以外を除去
  const cleaned = s.replace(/[^\d.,-]/g, "");

  // カンマを除去（"1,234.56" -> "1234.56"）
  const normalized = cleaned.replace(/,/g, "");

  const n = Number(normalized);
  return Number.isFinite(n) ? n : 0;
}

// ==============================
// RESET MAIL
// ==============================

function sendResetMail_(to, loginId, token, myRefCode, plan) {
  // ✅ デバッグログ（GAS実行ログで確認可能）
  Logger.log("[sendResetMail_] called: to=" + to + " loginId=" + loginId + " tokenLen=" + (token ? token.length : 0));

  if (!to) {
    Logger.log("[sendResetMail_] ABORT: to is empty");
    throw new Error("sendResetMail_: to address is empty");
  }
  if (!loginId) {
    Logger.log("[sendResetMail_] ABORT: loginId is empty");
    throw new Error("sendResetMail_: loginId is empty");
  }
  if (!token) {
    Logger.log("[sendResetMail_] ABORT: token is empty");
    throw new Error("sendResetMail_: token is empty");
  }

  // ✅ クォータチェック（残り0なら即エラー）
  try {
    const remaining = MailApp.getRemainingDailyQuota();
    Logger.log("[sendResetMail_] quota remaining=" + remaining);
    if (remaining <= 0) {
      throw new Error("sendResetMail_: MailApp daily quota exhausted (remaining=0)");
    }
  } catch (quotaErr) {
    // getRemainingDailyQuota 自体が失敗することはほぼないが安全のため
    Logger.log("[sendResetMail_] quota check error: " + String(quotaErr));
    throw quotaErr;
  }

  const is5000 = plan === "5000";
  const resetPath = "https://lifaiov.vercel.app/reset?plan=5000&token=" + encodeURIComponent(token);
  const loginUrl = "https://lifaiov.vercel.app/5000/login";
  const url = resetPath;
  const subject = "【LIFAI】初回パスワード設定のご案内";

  const body =
    "LIFAIへのご登録ありがとうございます。\n\n" +
    "初回パスワード設定はこちら（72時間有効）：\n" +
    url +
    "\n\n" +
    "ログインID：\n" +
    loginId +
    "\n\n" +
    "このURLは1回のみ利用できます。\n\n" +
    "パスワード設定後はこちらからログインできます：\n" +
    loginUrl + "\n\n" +
    "もしパスワードの設定がうまくできなかった場合は、公式LINEにてお名前とメールアドレスを添えてご連絡ください。\n" +
    "対応いたします。\n" +
    "https://lin.ee/VPo2xOn\n\n" +
    "LIFAI公式" +
    (myRefCode ? "\n\n--------------------\nあなたの紹介コード：" + myRefCode + "\n友人をLIFAIに紹介する際にお使いください。\n--------------------" : "");

  Logger.log('[sendMail] to=' + to);
  try {
    MailApp.sendEmail({
      to: to,
      subject: subject,
      body: body,
      name: "LIFAI公式",
    });
    Logger.log('[sendMail] SUCCESS');
  } catch (e) {
    Logger.log('[sendMail] FAILED: ' + e);
    // mail_error列への書き込みはシート参照を持つ呼び出し元（approveRowCore_ 等）で行う
    throw e;
  }
}

// ==============================
// ✅ Referral Helpers（今回追加：壊さない）
// ==============================

function resolveRefChain_(sheet, header, usedRefCode) {
  // usedRefCode (= ref_code) から、ref1〜ref5 を特定して返す（5段対応・循環防止付き）
  // 後方互換: ref1/ref2/ref3 は従来通り返す。ref4/ref5 を追加。
  const empty = { ref1_login_id: "", ref2_login_id: "", ref3_login_id: "", ref4_login_id: "", ref5_login_id: "" };
  if (!usedRefCode) return empty;

  const values = getValuesSafe_(sheet);
  if (!values || values.length < 2) return empty;
  const h   = values[0];
  const idx = indexMap_(h);

  if (idx["my_ref_code"] === undefined || idx["login_id"] === undefined) return empty;

  // ref_code → 紹介者(ref1) の login_id を検索
  let ref1 = "";
  for (let i = 1; i < values.length; i++) {
    if (str_(values[i][idx["my_ref_code"]]) === usedRefCode) {
      ref1 = str_(values[i][idx["login_id"]]);
      break;
    }
  }
  if (!ref1) return empty;

  // ref1 の親を辿って chain を組み立てる（最大4回・循環防止）
  const chain   = [ref1];
  const visited = {};
  visited[ref1]  = true;
  let cur        = ref1;

  for (let depth = 0; depth < 4; depth++) {
    let parent = "";
    for (let i = 1; i < values.length; i++) {
      if (str_(values[i][idx["login_id"]]) === cur) {
        parent = idx["referrer_login_id"] !== undefined ? str_(values[i][idx["referrer_login_id"]]) : "";
        break;
      }
    }
    if (!parent || visited[parent]) break;
    visited[parent] = true;
    chain.push(parent);
    cur = parent;
  }

  return {
    ref1_login_id: chain[0] || "",
    ref2_login_id: chain[1] || "",
    ref3_login_id: chain[2] || "",
    ref4_login_id: chain[3] || "",
    ref5_login_id: chain[4] || "",
  };
}

function appendRefEvent_(o) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const ev = getOrCreateSheetByName_(ss, "ref_events", [
      "ts",
      "new_login_id",
      "new_email",
      "used_ref_code",
      "ref1_login_id",
      "ref2_login_id",
      "ref3_login_id",
      "note",
    ]);

    ev.appendRow([
      new Date(),
      str_(o.new_login_id),
      str_(o.new_email),
      str_(o.used_ref_code),
      str_(o.ref1_login_id),
      str_(o.ref2_login_id),
      str_(o.ref3_login_id),
      str_(o.note),
    ]);
  } catch (e) {
    // ログだけ（壊さない）
  }
}

function getOrCreateSheetByName_(ss, name, headerRow) {
  let s = ss.getSheetByName(name);
  if (!s) {
    s = ss.insertSheet(name);
    if (headerRow && headerRow.length) {
      s.appendRow(headerRow);
    }
  } else {
    // ヘッダーが空なら入れておく（壊さない）
    try {
      const lastRow = s.getLastRow();
      const lastCol = s.getLastColumn();

      // シートが空っぽ
      if (!lastRow || lastRow < 1 || !lastCol || lastCol < 1) {
        if (headerRow && headerRow.length) {
          s.appendRow(headerRow);
        }
      } else {
        // 1行目だけ安全に見る（DataRange爆発を踏まない）
        const firstRow = s.getRange(1, 1, 1, lastCol).getValues();
        const joined = (firstRow[0] || []).join("");
        if (joined === "") {
          if (headerRow && headerRow.length) {
            s.getRange(1, 1, 1, headerRow.length).setValues([headerRow]);
          }
        }
      }
    } catch (e) {}
  }
  return s;
}

// ==============================
// Helpers
// ==============================

function getSecrets_() {
  const props = PropertiesService.getScriptProperties();
  const SECRET = props.getProperty("SECRET_KEY") || "LIFAITOMAKEMONEY";
  const ADMIN_SECRET = props.getProperty("ADMIN_SECRET") || "CHANGE_ME_ADMIN_123";
  return { SECRET: SECRET, ADMIN_SECRET: ADMIN_SECRET };
}

// ==============================
// system_settings シートからレート設定を読み取る
// シートが存在しない場合はデフォルト値を返す（壊さない）
// ==============================
function getSystemSettings_() {
  try {
    const ss    = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName("system_settings");
    if (!sheet) {
      return { usdToJpy: 145, epPerJpy: 4, rates: [10, 5, 2, 2, 1] };
    }
    const values   = sheet.getDataRange().getValues();
    const settings = {};
    for (let i = 0; i < values.length; i++) {
      if (values[i][0]) settings[String(values[i][0])] = values[i][1];
    }
    return {
      usdToJpy: Number(settings["usd_to_jpy"]      || 145),
      epPerJpy: Number(settings["ep_per_jpy"]       || 4),
      rates: [
        Number(settings["affiliate_rate_1"] || 10),
        Number(settings["affiliate_rate_2"] || 5),
        Number(settings["affiliate_rate_3"] || 2),
        Number(settings["affiliate_rate_4"] || 2),
        Number(settings["affiliate_rate_5"] || 1),
      ],
    };
  } catch (e) {
    return { usdToJpy: 145, epPerJpy: 4, rates: [10, 5, 2, 2, 1] };
  }
}

function getOrCreateSheet_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName("applies");

  if (!sheet) {
    sheet = ss.insertSheet("applies");
    sheet.appendRow([
      "created_at",
      "plan",
      "email",
      "name",
      "name_kana",
      "ref_name",
      "ref_id",
      "region",
      "status",
      "code",
      "code_expires_at",
      "code_used_at",
      "apply_id",
      // ✅ サブスク・優先度カラム（壊さない：新規シート用）
      "subscription_plan",       // free / plus / pro / priority / partner
      "subscription_status",     // inactive / active / cancelled / past_due
      "subscription_started_at", // 開始日時
      "subscription_period_end", // 次回更新日
      "bp_cap",                  // BP上限値（サブスクプランで決まる）
      "bp_last_reset_at",        // 最後のBPリセット日時
      "job_priority_score",      // ジョブ優先度スコア（数値）
      "music_priority_level",    // 音楽案件優先レベル（0〜4）
      // ✅ ログインボーナス・日次集計カラム（壊さない：新規シート用）
      "last_login_at",           // 最終ログイン日時
      "login_streak",            // 連続ログイン日数
      "daily_bp_earned",         // 今日獲得したBP（日次リセット用）
      "daily_ep_earned",         // 今日獲得したEP（日次リセット用）
      "daily_reset_date",        // daily_bp/epをリセットした日付（YYYY-MM-DD）
      "total_login_count",       // 累計ログイン回数
    ]);
  }

  // ✅ 既存シートにも新カラムを追加（ヘッダー行のみ・データ行は変更しない）
  const lastCol = sheet.getLastColumn();
  const header = lastCol > 0 ? sheet.getRange(1, 1, 1, lastCol).getValues()[0] : [];
  ensureCols_(sheet, header, [
    "subscription_plan",
    "subscription_status",
    "subscription_started_at",
    "subscription_period_end",
    "bp_cap",
    "bp_last_reset_at",
    "job_priority_score",
    "music_priority_level",
    // ✅ ログインボーナス・日次集計カラム（壊さない）
    "last_login_at",       // 最終ログイン日時
    "login_streak",        // 連続ログイン日数
    "daily_bp_earned",     // 今日獲得したBP（日次リセット用）
    "daily_ep_earned",     // 今日獲得したEP（日次リセット用）
    "daily_reset_date",    // daily_bp/epをリセットした日付（YYYY-MM-DD）
    "total_login_count",   // 累計ログイン回数
  ]);

  return sheet;
}

function ensureCols_(sheet, header, cols) {
  for (var k = 0; k < cols.length; k++) {
    if (header.indexOf(cols[k]) === -1) {
      sheet.getRange(1, header.length + 1).setValue(cols[k]);
      header.push(cols[k]);
    }
  }
}

// ✅ 追加（今回）：巨大なDataRangeで落ちないように “実データ範囲だけ” を読む
function getValuesSafe_(sheet) {
  const lastRow = sheet.getLastRow();
  const lastCol = sheet.getLastColumn();
  if (!lastRow || lastRow < 1 || !lastCol || lastCol < 1) return [[]];
  return sheet.getRange(1, 1, lastRow, lastCol).getValues();
}

function pickKey_(e) {
  const key1 = e?.parameter?.key ? String(e.parameter.key) : "";
  const key2 = e?.parameters?.key?.[0] ? String(e.parameters.key[0]) : "";
  return key1 || key2 || "";
}

function indexMap_(header) {
  const map = {};
  header.forEach((h, i) => (map[String(h)] = i));
  return map;
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(
    ContentService.MimeType.JSON
  );
}

function dateStr_(v) {
  if (!v) return "";
  const d = v instanceof Date ? v : new Date(v);
  if (isNaN(d.getTime())) return String(v);
  const jst = new Date(d.getTime() + 9 * 60 * 60 * 1000);
  return jst.toISOString().slice(0, 10);
}

function str_(v) {
  return v === undefined || v === null ? "" : String(v);
}

function num_(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

// ✅ DataRange爆発を避ける（壊さない）
function getSheetValuesSafe_(s) {
  const lr = s.getLastRow();
  const lc = s.getLastColumn();
  if (!lr || lr < 1 || !lc || lc < 1) return [[]];
  return s.getRange(1, 1, lr, lc).getValues();
}
// ==============================
// Password / LoginId Helpers
// ==============================

function bytesToHex_(bytes) {
  return bytes
    .map(function (b) {
      var v = b < 0 ? b + 256 : b;
      return (v < 16 ? "0" : "") + v.toString(16);
    })
    .join("");
}

function hmacSha256Hex_(secret, text) {
  var sig = Utilities.computeHmacSha256Signature(text, secret);
  return bytesToHex_(sig);
}

function randChars_(len) {
  // 紛らわしい文字を避ける（0,O,1,l を抜く）
  var chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";
  var out = "";
  for (var i = 0; i < len; i++) {
    out += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return out;
}

function genLoginId_() {
  return "lifai_" + randChars_(6);
}

// 旧仕様の互換用：削除しない（今はadmin_approveでは使わない）
function genTempPassword_() {
  return randChars_(12);
}

// RESET TOKEN
function genResetToken_() {
  return Utilities.getUuid().replace(/-/g, "") + randChars_(16);
}

// ==============================
// ✅ /5000 スプレッドシートのappliesシートを返す（group:"5000" ルーティング用）
// ==============================
function getAppliesSheet5000_() {
  var ssId = PropertiesService.getScriptProperties().getProperty("SPREADSHEET_5000_ID");
  if (!ssId) throw new Error("SPREADSHEET_5000_ID not set");
  var ss5000 = SpreadsheetApp.openById(ssId);
  var s = ss5000.getSheetByName("applies");
  if (!s) throw new Error("applies sheet not found in SPREADSHEET_5000_ID");
  return s;
}

// ==============================
// ✅ /5000 紹介コード生成（"5K" + 6文字：紛らわしい文字除外）
// ==============================
function generateRefCode5000_(applySheet, idx) {
  var chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  var allRows = applySheet.getDataRange().getValues();
  var existing = allRows.map(function(r) { return str_(r[idx["my_ref_code"]] || ""); });
  var code;
  var maxTries = 200;
  var tries = 0;
  do {
    code = "5K";
    for (var i = 0; i < 6; i++) {
      code += chars[Math.floor(Math.random() * chars.length)];
    }
    tries++;
  } while (existing.indexOf(code) >= 0 && tries < maxTries);
  if (tries >= maxTries && existing.indexOf(code) >= 0) {
    throw new Error("generateRefCode5000_: failed to generate unique code after " + maxTries + " tries");
  }
  return code;
}

// ==============================
// ✅ /5000 月別台帳シートを取得または作成
// yearMonth 形式: "2026_03"
// ==============================
function getLedgerSheet5000_(ss5000, yearMonth) {
  var name = "ledger_" + yearMonth;
  var s = ss5000.getSheetByName(name);
  if (!s) {
    s = ss5000.insertSheet(name);
    s.appendRow(["created_at", "to_login_id", "type", "amount_usd", "from_apply_id", "level", "memo"]);
  }
  return s;
}

function __testSendMailOnce() {
  sendResetMail_("unitegawa@outlook.jp", "lifai_TEST", "TEST_TOKEN_123");
}

// ==============================
// ✅ デバッグ用：手動実行でメール送信テスト
// GASエディタ上で関数を選択して「実行」ボタンを押す
// ==============================

// クォータ残量確認（ログで確認）
function __debugCheckMailQuota() {
  const remaining = MailApp.getRemainingDailyQuota();
  Logger.log("[__debugCheckMailQuota] remaining=" + remaining);
  return remaining;
}

// 任意メアドへテスト送信（引数なしならデフォルト宛先へ）
function __debugSendMail(email) {
  const target = email || "unitegawa@outlook.jp";
  Logger.log("[__debugSendMail] start: target=" + target);
  Logger.log("[__debugSendMail] quota=" + MailApp.getRemainingDailyQuota());
  try {
    sendResetMail_(target, "debug_login_id", "debug_token_0000000000000000");
    Logger.log("[__debugSendMail] SUCCESS");
    return "OK: mail sent to " + target;
  } catch (e) {
    Logger.log("[__debugSendMail] FAILED: " + String(e));
    return "NG: " + String(e);
  }
}

// シートの特定行を強制再承認（email指定）
function __debugApproveByEmail(email) {
  const sheet = getOrCreateSheet_();
  const values = getValuesSafe_(sheet);
  const header = values[0];
  const idx = indexMap_(header);
  const rows = values.slice(1);

  const emailIdx = idx["email"];
  if (emailIdx === undefined) {
    Logger.log("[__debugApproveByEmail] email column not found");
    return "NG: email column not found";
  }

  let targetRowIndex = 0;
  for (let i = 0; i < rows.length; i++) {
    if (str_(rows[i][emailIdx]) === email) {
      targetRowIndex = i + 2;
      break;
    }
  }

  if (!targetRowIndex) {
    Logger.log("[__debugApproveByEmail] not found: " + email);
    return "NG: email not found in sheet";
  }

  Logger.log("[__debugApproveByEmail] found at row=" + targetRowIndex + " email=" + email);

  // reset_sent_at を強制クリアして再送を許可
  if (idx["reset_sent_at"] !== undefined) {
    sheet.getRange(targetRowIndex, idx["reset_sent_at"] + 1).setValue("");
    Logger.log("[__debugApproveByEmail] reset_sent_at cleared");
  }
  // pw_hash も強制クリア（再設定フローを開始させる）
  if (idx["pw_hash"] !== undefined) {
    sheet.getRange(targetRowIndex, idx["pw_hash"] + 1).setValue("");
    Logger.log("[__debugApproveByEmail] pw_hash cleared");
  }

  const res = approveRowCore_(sheet, header, idx, targetRowIndex, "debug_force_approve");
  Logger.log("[__debugApproveByEmail] result=" + JSON.stringify(res));
  return JSON.stringify(res);
}

// ==============================
// MARKET機能（追記のみ・既存コードは一切触らない）
// ✅ 追加シート: market_items / market_orders / market_escrow / market_reports / market_daily_limits
// ✅ 追加アクション: market_list / market_item / market_create / market_buy / market_confirm / market_refund / market_report
// ✅ doPost / doGet を末尾再定義して market_ アクションをルーティング（GAS V8では末尾定義が優先）
// ==============================

// ---- 定数 ----
var MARKET_FEE_RATE_ = 0.055;
var MARKET_DAILY_LIST_LIMIT_ = 5;
var MARKET_REPORT_HIDDEN_THRESHOLD_ = 3;
var MARKET_SYSTEM_TREASURY_ = "SYSTEM_TREASURY";
var MARKET_SYSTEM_ESCROW_ = "SYSTEM_ESCROW";
var MARKET_MIN_PRICE_ = 50;
var MARKET_MIN_EP_TO_LIST_ = 1;
var MARKET_RESERVE_HOURS_ = 24;

// ---- doPost 再定義（market_ / gift_ アクションをそれぞれのハンドラへルーティング）----
// NOTE: この doPost/doGet 定義は後方の最終定義に上書きされるため無効です。
/*
function doPost(e) {
  try {
    const key = pickKey_(e);
    const body = JSON.parse(e?.postData?.contents || "{}");
    const action = str_(body.action);
    if (action && action.startsWith("market_")) {
      return handleMarket_(key, body);
    }
    if (action && action.startsWith("gift_")) {
      return handleGift_(key, body);
    }
    return handle_(key, body);
  } catch (err) {
    return json_({ ok: false, error: String(err) });
  }
}

// ---- doGet 再定義（market_ アクションを handleMarket_ へルーティング、既存ロジックは保持）----
function doGet(e) {
  try {
    const key = pickKey_(e);
    const action = str_(e?.parameter?.action);

    if (!action) {
      return json_({ ok: false, error: "method_not_allowed" });
    }

    if (action.startsWith("market_")) {
      const body = {
        action,
        id: str_(e?.parameter?.id),
        code: str_(e?.parameter?.code),
        adminKey: str_(e?.parameter?.adminKey),
        item_id: str_(e?.parameter?.item_id),
        order_id: str_(e?.parameter?.order_id),
        status: str_(e?.parameter?.status),
        page: num_(e?.parameter?.page),
        limit: num_(e?.parameter?.limit),
        title: str_(e?.parameter?.title),
        desc: str_(e?.parameter?.desc),
        item_type: str_(e?.parameter?.item_type),
        asset_count: num_(e?.parameter?.asset_count),
        currency: str_(e?.parameter?.currency),
        price: num_(e?.parameter?.price),
        delivery_mode: str_(e?.parameter?.delivery_mode),
        delivery_ref: str_(e?.parameter?.delivery_ref),
        stock_total: num_(e?.parameter?.stock_total),
        reason: str_(e?.parameter?.reason),
        message: str_(e?.parameter?.message),
        note: str_(e?.parameter?.note),
      };
      return handleMarket_(key, body);
    }

    // 既存 doGet ロジック（handle_ へのルーティング）
    const pseudoBody = {
      action,
      adminKey: str_(e?.parameter?.adminKey),
      rowIndex: num_(e?.parameter?.rowIndex),
      id: str_(e?.parameter?.id),
      code: str_(e?.parameter?.code),
      plan: str_(e?.parameter?.plan),
      email: str_(e?.parameter?.email),
      name: str_(e?.parameter?.name),
      nameKana: str_(e?.parameter?.nameKana),
      discordId: str_(e?.parameter?.discordId),
      ageBand: str_(e?.parameter?.ageBand),
      prefecture: str_(e?.parameter?.prefecture),
      city: str_(e?.parameter?.city),
      job: str_(e?.parameter?.job),
      refName: str_(e?.parameter?.refName),
      refId: str_(e?.parameter?.refId),
      refCode: str_(e?.parameter?.refCode),
      region: str_(e?.parameter?.region),
      applyId: str_(e?.parameter?.applyId),
      orderId: str_(e?.parameter?.orderId),
      paymentStatus: str_(e?.parameter?.paymentStatus),
      isPaid: str_(e?.parameter?.isPaid),
      invoiceId: str_(e?.parameter?.invoiceId),
      actuallyPaid: str_(e?.parameter?.actuallyPaid),
      payAmount: str_(e?.parameter?.payAmount),
      payCurrency: str_(e?.parameter?.payCurrency),
      priceAmount: str_(e?.parameter?.priceAmount),
      priceCurrency: str_(e?.parameter?.priceCurrency),
      token: str_(e?.parameter?.token),
      password: str_(e?.parameter?.password),
    };
    return handle_(key, pseudoBody);
  } catch (err) {
    return json_({ ok: false, error: String(err) });
  }
}
*/

// ==============================
// handleMarket_ : market_* アクションのメインハンドラ
// ==============================
function handleMarket_(key, body) {
  const secrets = getSecrets_();
  if (key !== secrets.SECRET) return json_({ ok: false, error: "unauthorized" });
  const SECRET = secrets.SECRET;
  const ADMIN_SECRET = secrets.ADMIN_SECRET;

  const action = str_(body.action);

  // =========================================================
  // market_list（一覧取得：認証不要）
  // =========================================================
  if (action === "market_list") {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = mktGetSheet_(ss, "market_items");
    const values = getValuesSafe_(sheet);
    if (values.length < 2) return json_({ ok: true, items: [], total: 0 });

    const header = values[0];
    const idx = indexMap_(header);
    const rows = values.slice(1);

    const filterStatus = str_(body.status) || "active";
    const page = Math.max(1, num_(body.page) || 1);
    const limit = Math.min(50, Math.max(1, num_(body.limit) || 20));
    const offset = (page - 1) * limit;

    let filtered = rows.filter(function(r) {
      return str_(r[idx["status"]]) === filterStatus;
    });
    // seller_idフィルター（追記）
    filtered = body.seller_id
      ? filtered.filter(function(r) { return str_(r[idx["seller_id"]]) === str_(body.seller_id); })
      : filtered;
    const paged = filtered.slice(offset, offset + limit);
    const items = paged.map(function(r) { return mktRowToItem_(r, idx); });

    return json_({ ok: true, items: items, total: filtered.length, page: page, limit: limit });
  }

  // =========================================================
  // market_item（詳細取得：認証不要）
  // =========================================================
  if (action === "market_item") {
    const itemId = str_(body.item_id);
    if (!itemId) return json_({ ok: false, error: "missing_item_id" });

    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = mktGetSheet_(ss, "market_items");
    const values = getValuesSafe_(sheet);
    if (values.length < 2) return json_({ ok: false, error: "not_found" });

    const header = values[0];
    const idx = indexMap_(header);
    const rows = values.slice(1);

    for (var i = 0; i < rows.length; i++) {
      if (str_(rows[i][idx["item_id"]]) === itemId) {
        return json_({ ok: true, item: mktRowToItem_(rows[i], idx) });
      }
    }
    return json_({ ok: false, error: "not_found" });
  }

  // =========================================================
  // market_create（出品：1日5件制限・EP制限・最低価格50・最低枚数チェック）
  // =========================================================
  if (action === "market_create") {
    const id = str_(body.id);
    const code = str_(body.code);
    if (!id || !code) return json_({ ok: false, error: "missing_auth" });

    const user = mktAuth_(SECRET, id, code);
    if (!user.ok) return json_({ ok: false, error: "auth_failed", reason: user.reason });

    const title = str_(body.title).trim();
    const desc = str_(body.desc).trim();
    const itemType = str_(body.item_type).trim();
    const currency = str_(body.currency).trim() || "EP";
    const price = num_(body.price);
    const deliveryMode = str_(body.delivery_mode).trim();
    const deliveryRef = str_(body.delivery_ref).trim();
    const stockTotal = Math.max(1, num_(body.stock_total) || 1);
    const assetCount = num_(body.asset_count) || 0;

    if (!title) return json_({ ok: false, error: "missing_title" });
    if (!itemType) return json_({ ok: false, error: "missing_item_type" });
    if (price < MARKET_MIN_PRICE_) {
      return json_({ ok: false, error: "price_too_low", min: MARKET_MIN_PRICE_ });
    }

    // 最低枚数チェック（asset系は1枚以上必須）
    if (itemType === "nft" || itemType === "asset" || itemType === "digital_item") {
      if (assetCount < 1) {
        return json_({ ok: false, error: "asset_count_required", min: 1 });
      }
    }

    // EP制限チェック
    if (user.ep_balance < MARKET_MIN_EP_TO_LIST_) {
      return json_({ ok: false, error: "ep_insufficient_to_list", required: MARKET_MIN_EP_TO_LIST_, current: user.ep_balance });
    }

    // 1日5件制限
    const today = mktTodayJst_();
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const limitSheet = mktGetSheet_(ss, "market_daily_limits");
    const listedCount = mktGetDailyListCount_(limitSheet, user.login_id, today);
    if (listedCount >= MARKET_DAILY_LIST_LIMIT_) {
      return json_({ ok: false, error: "daily_limit_exceeded", limit: MARKET_DAILY_LIST_LIMIT_ });
    }

    const itemId = "ITM_" + Utilities.getUuid().replace(/-/g, "").substring(0, 16).toUpperCase();
    const now = new Date();
    const itemSheet = mktGetSheet_(ss, "market_items");

    itemSheet.appendRow([
      itemId,                               // item_id
      user.login_id,                        // seller_id
      user.name || user.login_id,           // seller_name
      title,                                // title
      desc,                                 // desc
      itemType,                             // item_type
      assetCount,                           // asset_count
      currency,                             // currency
      price,                                // price
      MARKET_FEE_RATE_,                     // fee_rate
      deliveryMode,                         // delivery_mode
      deliveryRef,                          // delivery_ref
      stockTotal,                           // stock_total
      0,                                    // stock_sold
      0,                                    // stock_reserved
      "active",                             // status
      0,                                    // report_count
      now,                                  // created_at
      now,                                  // updated_at
    ]);

    mktIncrDailyListCount_(limitSheet, user.login_id, today);

    return json_({ ok: true, item_id: itemId });
  }

  // =========================================================
  // market_buy（即購入：在庫予約ロック→残高確認→エスクロー移転）
  // =========================================================
  if (action === "market_buy") {
    const id = str_(body.id);
    const code = str_(body.code);
    if (!id || !code) return json_({ ok: false, error: "missing_auth" });

    const user = mktAuth_(SECRET, id, code);
    if (!user.ok) return json_({ ok: false, error: "auth_failed", reason: user.reason });

    const itemId = str_(body.item_id);
    if (!itemId) return json_({ ok: false, error: "missing_item_id" });

    const lock = LockService.getScriptLock();
    try { lock.waitLock(8000); } catch (e) { return json_({ ok: false, error: "lock_timeout" }); }

    try {
      const ss = SpreadsheetApp.getActiveSpreadsheet();
      const itemSheet = mktGetSheet_(ss, "market_items");
      const itemValues = getValuesSafe_(itemSheet);
      if (itemValues.length < 2) return json_({ ok: false, error: "not_found" });

      const iHeader = itemValues[0];
      const iIdx = indexMap_(iHeader);
      const iRows = itemValues.slice(1);

      var itemRowIndex = -1;
      var itemRow = null;
      for (var i = 0; i < iRows.length; i++) {
        if (str_(iRows[i][iIdx["item_id"]]) === itemId) {
          itemRowIndex = i + 2;
          itemRow = iRows[i];
          break;
        }
      }
      if (!itemRow) return json_({ ok: false, error: "not_found" });

      if (str_(itemRow[iIdx["status"]]) !== "active") {
        return json_({ ok: false, error: "item_not_available" });
      }

      const sellerId = str_(itemRow[iIdx["seller_id"]]);
      if (sellerId === user.login_id) {
        return json_({ ok: false, error: "cannot_buy_own_item" });
      }

      const stockTotal = num_(itemRow[iIdx["stock_total"]]);
      const stockSold = num_(itemRow[iIdx["stock_sold"]]);
      const stockReserved = num_(itemRow[iIdx["stock_reserved"]]);
      if (stockTotal - stockSold - stockReserved < 1) {
        return json_({ ok: false, error: "out_of_stock" });
      }

      const price = num_(itemRow[iIdx["price"]]);
      const currency = str_(itemRow[iIdx["currency"]]);

      // 残高確認
      if (user.ep_balance < price) {
        return json_({ ok: false, error: "ep_insufficient", required: price, current: user.ep_balance });
      }

      // 在庫予約ロック
      itemSheet.getRange(itemRowIndex, iIdx["stock_reserved"] + 1).setValue(stockReserved + 1);
      itemSheet.getRange(itemRowIndex, iIdx["updated_at"] + 1).setValue(new Date());

      // 注文作成
      const orderId = "ORD_" + Utilities.getUuid().replace(/-/g, "").substring(0, 16).toUpperCase();
      const feeAmount = Math.round(price * MARKET_FEE_RATE_ * 100) / 100;
      const sellerNet = Math.round((price - feeAmount) * 100) / 100;
      const now = new Date();
      const reservedUntil = new Date(now.getTime() + MARKET_RESERVE_HOURS_ * 60 * 60 * 1000);

      const orderSheet = mktGetSheet_(ss, "market_orders");
      orderSheet.appendRow([
        orderId,        // order_id
        itemId,         // item_id
        user.login_id,  // buyer_id
        sellerId,       // seller_id
        currency,       // currency
        price,          // price
        feeAmount,      // fee_amount
        sellerNet,      // seller_net
        "paid",         // status（即時エスクロー移転）
        reservedUntil,  // reserved_until
        now,            // paid_at
        "",             // delivered_at
        "",             // confirmed_at
        "",             // refunded_at
        "",             // note
        now,            // created_at
        now,            // updated_at
      ]);

      // エスクロー作成
      const escrowId = "ESC_" + Utilities.getUuid().replace(/-/g, "").substring(0, 16).toUpperCase();
      const escrowSheet = mktGetSheet_(ss, "market_escrow");
      escrowSheet.appendRow([
        escrowId,  // escrow_id
        orderId,   // order_id
        currency,  // currency
        price,     // hold_amount
        "held",    // state
        now,       // created_at
        now,       // updated_at
      ]);

      // 買い手 EP をデビット
      mktAdjustEp_(user.login_id, user.email, -price, "market_buy",
        "order=" + orderId + " item=" + itemId);

      return json_({
        ok: true,
        order_id: orderId,
        escrow_id: escrowId,
        price: price,
        fee_amount: feeAmount,
        seller_net: sellerNet,
      });
    } finally {
      lock.releaseLock();
    }
  }

  // =========================================================
  // market_confirm（受領確定：手数料5.5%→運営・残りを出品者に）
  // =========================================================
  if (action === "market_confirm") {
    const id = str_(body.id);
    const code = str_(body.code);
    if (!id || !code) return json_({ ok: false, error: "missing_auth" });

    const user = mktAuth_(SECRET, id, code);
    if (!user.ok) return json_({ ok: false, error: "auth_failed", reason: user.reason });

    const orderId = str_(body.order_id);
    if (!orderId) return json_({ ok: false, error: "missing_order_id" });

    const lock = LockService.getScriptLock();
    try { lock.waitLock(8000); } catch (e) { return json_({ ok: false, error: "lock_timeout" }); }

    try {
      const ss = SpreadsheetApp.getActiveSpreadsheet();
      const orderSheet = mktGetSheet_(ss, "market_orders");
      const orderValues = getValuesSafe_(orderSheet);
      if (orderValues.length < 2) return json_({ ok: false, error: "not_found" });

      const oHeader = orderValues[0];
      const oIdx = indexMap_(oHeader);
      const oRows = orderValues.slice(1);

      var orderRowIndex = -1;
      var orderRow = null;
      for (var i = 0; i < oRows.length; i++) {
        if (str_(oRows[i][oIdx["order_id"]]) === orderId) {
          orderRowIndex = i + 2;
          orderRow = oRows[i];
          break;
        }
      }
      if (!orderRow) return json_({ ok: false, error: "not_found" });

      // 買い手のみ確定できる
      const buyerId = str_(orderRow[oIdx["buyer_id"]]);
      if (buyerId !== user.login_id) return json_({ ok: false, error: "not_buyer" });

      const orderStatus = str_(orderRow[oIdx["status"]]);
      if (orderStatus !== "paid") {
        return json_({ ok: false, error: "invalid_order_status", status: orderStatus });
      }

      const sellerId = str_(orderRow[oIdx["seller_id"]]);
      const itemId = str_(orderRow[oIdx["item_id"]]);
      const price = num_(orderRow[oIdx["price"]]);
      const feeAmount = num_(orderRow[oIdx["fee_amount"]]);
      const sellerNet = num_(orderRow[oIdx["seller_net"]]);
      const now = new Date();

      // 注文ステータス更新
      orderSheet.getRange(orderRowIndex, oIdx["status"] + 1).setValue("confirmed");
      orderSheet.getRange(orderRowIndex, oIdx["confirmed_at"] + 1).setValue(now);
      orderSheet.getRange(orderRowIndex, oIdx["updated_at"] + 1).setValue(now);

      // エスクロー → released
      const escrowSheet = mktGetSheet_(ss, "market_escrow");
      const escrowValues = getValuesSafe_(escrowSheet);
      if (escrowValues.length >= 2) {
        const eHeader = escrowValues[0];
        const eIdx = indexMap_(eHeader);
        const eRows = escrowValues.slice(1);
        for (var j = 0; j < eRows.length; j++) {
          if (str_(eRows[j][eIdx["order_id"]]) === orderId &&
              str_(eRows[j][eIdx["state"]]) === "held") {
            escrowSheet.getRange(j + 2, eIdx["state"] + 1).setValue("released");
            escrowSheet.getRange(j + 2, eIdx["updated_at"] + 1).setValue(now);
            break;
          }
        }
      }

      // 在庫更新: stock_sold++ / stock_reserved--
      const itemSheet = mktGetSheet_(ss, "market_items");
      const itemValues = getValuesSafe_(itemSheet);
      if (itemValues.length >= 2) {
        const iHeader = itemValues[0];
        const iIdx = indexMap_(iHeader);
        const iRows = itemValues.slice(1);
        for (var k = 0; k < iRows.length; k++) {
          if (str_(iRows[k][iIdx["item_id"]]) === itemId) {
            const curSold = num_(iRows[k][iIdx["stock_sold"]]);
            const curReserved = num_(iRows[k][iIdx["stock_reserved"]]);
            const stockTotal = num_(iRows[k][iIdx["stock_total"]]);
            itemSheet.getRange(k + 2, iIdx["stock_sold"] + 1).setValue(curSold + 1);
            itemSheet.getRange(k + 2, iIdx["stock_reserved"] + 1).setValue(Math.max(0, curReserved - 1));
            itemSheet.getRange(k + 2, iIdx["updated_at"] + 1).setValue(now);
            // 在庫切れなら sold_out に
            if (curSold + 1 >= stockTotal) {
              itemSheet.getRange(k + 2, iIdx["status"] + 1).setValue("sold_out");
            }
            break;
          }
        }
      }

      // 出品者に seller_net を付与
      const sellerUser = mktGetUserByLoginId_(sellerId);
      mktAdjustEp_(sellerId, sellerUser ? sellerUser.email : "", sellerNet,
        "market_confirm_seller", "order=" + orderId + " item=" + itemId + " net=" + sellerNet);

      // 手数料を SYSTEM_TREASURY へ記録（wallet_ledger のみ）
      try {
        appendWalletLedger_({
          ts: now,
          kind: "market_confirm_fee",
          login_id: MARKET_SYSTEM_TREASURY_,
          email: "",
          amount: feeAmount,
          memo: "order=" + orderId + " item=" + itemId + " fee=" + feeAmount,
        });
      } catch (e) {}

      return json_({ ok: true, order_id: orderId, seller_net: sellerNet, fee_amount: feeAmount });
    } finally {
      lock.releaseLock();
    }
  }

  // =========================================================
  // market_refund（返金：adminKeyが必要）
  // =========================================================
  if (action === "market_refund") {
    const adminKey = str_(body.adminKey);
    if (adminKey !== ADMIN_SECRET) return json_({ ok: false, error: "admin_unauthorized" });

    const orderId = str_(body.order_id);
    if (!orderId) return json_({ ok: false, error: "missing_order_id" });

    const lock = LockService.getScriptLock();
    try { lock.waitLock(8000); } catch (e) { return json_({ ok: false, error: "lock_timeout" }); }

    try {
      const ss = SpreadsheetApp.getActiveSpreadsheet();
      const orderSheet = mktGetSheet_(ss, "market_orders");
      const orderValues = getValuesSafe_(orderSheet);
      if (orderValues.length < 2) return json_({ ok: false, error: "not_found" });

      const oHeader = orderValues[0];
      const oIdx = indexMap_(oHeader);
      const oRows = orderValues.slice(1);

      var orderRowIndex = -1;
      var orderRow = null;
      for (var i = 0; i < oRows.length; i++) {
        if (str_(oRows[i][oIdx["order_id"]]) === orderId) {
          orderRowIndex = i + 2;
          orderRow = oRows[i];
          break;
        }
      }
      if (!orderRow) return json_({ ok: false, error: "not_found" });

      const orderStatus = str_(orderRow[oIdx["status"]]);
      if (orderStatus !== "paid" && orderStatus !== "reserved") {
        return json_({ ok: false, error: "invalid_order_status", status: orderStatus });
      }

      const buyerId = str_(orderRow[oIdx["buyer_id"]]);
      const itemId = str_(orderRow[oIdx["item_id"]]);
      const price = num_(orderRow[oIdx["price"]]);
      const note = str_(body.note) || "admin_refund";
      const now = new Date();

      // 注文ステータス更新
      orderSheet.getRange(orderRowIndex, oIdx["status"] + 1).setValue("refunded");
      orderSheet.getRange(orderRowIndex, oIdx["refunded_at"] + 1).setValue(now);
      orderSheet.getRange(orderRowIndex, oIdx["note"] + 1).setValue(note);
      orderSheet.getRange(orderRowIndex, oIdx["updated_at"] + 1).setValue(now);

      // エスクロー → refunded
      const escrowSheet = mktGetSheet_(ss, "market_escrow");
      const escrowValues = getValuesSafe_(escrowSheet);
      if (escrowValues.length >= 2) {
        const eHeader = escrowValues[0];
        const eIdx = indexMap_(eHeader);
        const eRows = escrowValues.slice(1);
        for (var j = 0; j < eRows.length; j++) {
          if (str_(eRows[j][eIdx["order_id"]]) === orderId &&
              str_(eRows[j][eIdx["state"]]) === "held") {
            escrowSheet.getRange(j + 2, eIdx["state"] + 1).setValue("refunded");
            escrowSheet.getRange(j + 2, eIdx["updated_at"] + 1).setValue(now);
            break;
          }
        }
      }

      // 在庫予約を解放: stock_reserved--
      const itemSheet = mktGetSheet_(ss, "market_items");
      const itemValues = getValuesSafe_(itemSheet);
      if (itemValues.length >= 2) {
        const iHeader = itemValues[0];
        const iIdx = indexMap_(iHeader);
        const iRows = itemValues.slice(1);
        for (var k = 0; k < iRows.length; k++) {
          if (str_(iRows[k][iIdx["item_id"]]) === itemId) {
            const curReserved = num_(iRows[k][iIdx["stock_reserved"]]);
            itemSheet.getRange(k + 2, iIdx["stock_reserved"] + 1).setValue(Math.max(0, curReserved - 1));
            itemSheet.getRange(k + 2, iIdx["updated_at"] + 1).setValue(now);
            break;
          }
        }
      }

      // 買い手に返金
      const buyerUser = mktGetUserByLoginId_(buyerId);
      mktAdjustEp_(buyerId, buyerUser ? buyerUser.email : "", price,
        "market_refund", "order=" + orderId + " item=" + itemId + " note=" + note);

      return json_({ ok: true, order_id: orderId, refunded_amount: price, buyer_id: buyerId });
    } finally {
      lock.releaseLock();
    }
  }

  // =========================================================
  // market_report（通報：重複防止・3件で自動hidden）
  // =========================================================
  if (action === "market_report") {
    const id = str_(body.id);
    const code = str_(body.code);
    if (!id || !code) return json_({ ok: false, error: "missing_auth" });

    const user = mktAuth_(SECRET, id, code);
    if (!user.ok) return json_({ ok: false, error: "auth_failed", reason: user.reason });

    const itemId = str_(body.item_id);
    const reason = str_(body.reason).trim();
    const message = str_(body.message).trim();

    if (!itemId) return json_({ ok: false, error: "missing_item_id" });
    if (!reason) return json_({ ok: false, error: "missing_reason" });

    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const reportSheet = mktGetSheet_(ss, "market_reports");
    const reportValues = getValuesSafe_(reportSheet);

    // 重複チェック
    if (reportValues.length >= 2) {
      const rHeader = reportValues[0];
      const rIdx = indexMap_(rHeader);
      const rRows = reportValues.slice(1);
      for (var i = 0; i < rRows.length; i++) {
        if (str_(rRows[i][rIdx["item_id"]]) === itemId &&
            str_(rRows[i][rIdx["reporter_id"]]) === user.login_id) {
          return json_({ ok: false, error: "already_reported" });
        }
      }
    }

    const reportId = "RPT_" + Utilities.getUuid().replace(/-/g, "").substring(0, 16).toUpperCase();
    const now = new Date();

    reportSheet.appendRow([
      reportId,       // report_id
      itemId,         // item_id
      user.login_id,  // reporter_id
      reason,         // reason
      message,        // message
      now,            // created_at
    ]);

    // アイテムの report_count を更新し、閾値超えなら hidden に
    const itemSheet = mktGetSheet_(ss, "market_items");
    const itemValues = getValuesSafe_(itemSheet);
    if (itemValues.length >= 2) {
      const iHeader = itemValues[0];
      const iIdx = indexMap_(iHeader);
      const iRows = itemValues.slice(1);
      for (var j = 0; j < iRows.length; j++) {
        if (str_(iRows[j][iIdx["item_id"]]) === itemId) {
          const curCount = num_(iRows[j][iIdx["report_count"]]) + 1;
          itemSheet.getRange(j + 2, iIdx["report_count"] + 1).setValue(curCount);
          itemSheet.getRange(j + 2, iIdx["updated_at"] + 1).setValue(now);
          if (curCount >= MARKET_REPORT_HIDDEN_THRESHOLD_) {
            itemSheet.getRange(j + 2, iIdx["status"] + 1).setValue("hidden");
          }
          break;
        }
      }
    }

    return json_({ ok: true, report_id: reportId });
  }

  // =========================================================
  // market_my_orders（購入履歴取得：buyer_id で自分の注文一覧）
  // =========================================================
  if (action === "market_my_orders") {
    const id = str_(body.id);
    const code = str_(body.code);
    if (!id || !code) return json_({ ok: false, error: "missing_auth" });

    const user = mktAuth_(SECRET, id, code);
    if (!user.ok) return json_({ ok: false, error: "auth_failed", reason: user.reason });

    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const orderSheet = mktGetSheet_(ss, "market_orders");
    const orderValues = getValuesSafe_(orderSheet);

    if (orderValues.length < 2) return json_({ ok: true, orders: [] });

    const oHeader = orderValues[0];
    const oIdx = indexMap_(oHeader);
    const oRows = orderValues.slice(1);

    // item_idからタイトルを引くためにmarket_itemsを読む
    const itemSheet = mktGetSheet_(ss, "market_items");
    const itemValues = getValuesSafe_(itemSheet);
    const itemTitleMap = {};
    const itemTypeMap = {};
    if (itemValues.length >= 2) {
      const iHeader = itemValues[0];
      const iIdx = indexMap_(iHeader);
      itemValues.slice(1).forEach(function(row) {
        const iid = str_(row[iIdx["item_id"]]);
        itemTitleMap[iid] = str_(row[iIdx["title"]]);
        itemTypeMap[iid] = str_(row[iIdx["item_type"]]);
      });
    }

    const orders = [];
    for (var i = 0; i < oRows.length; i++) {
      const row = oRows[i];
      if (str_(row[oIdx["buyer_id"]]) !== user.login_id) continue;
      const itemId = str_(row[oIdx["item_id"]]);
      orders.push({
        order_id:   str_(row[oIdx["order_id"]]),
        item_id:    itemId,
        item_title: itemTitleMap[itemId] || "",
        item_type:  itemTypeMap[itemId] || "",
        currency:   str_(row[oIdx["currency"]]),
        price:      num_(row[oIdx["price"]]),
        status:     str_(row[oIdx["status"]]),
        paid_at:    str_(row[oIdx["paid_at"]]),
        confirmed_at: str_(row[oIdx["confirmed_at"]]),
        refunded_at:  str_(row[oIdx["refunded_at"]]),
      });
    }

    // 新しい順に並べ直し
    orders.sort(function(a, b) {
      return new Date(b.paid_at).getTime() - new Date(a.paid_at).getTime();
    });

    return json_({ ok: true, orders: orders });
  }

  return json_({ ok: false, error: "bad_action" });
}

// ==============================
// 7日自動確定（time-based trigger から呼び出す）
// ==============================

/**
 * GASのtime-based triggerに登録する関数。
 * 1日1回程度実行する。
 * 条件：status=paid かつ paid_at から7日以上経過
 *        かつ refund_requested フラグなし（現状ordersシートに列がなければスキップ）
 *        かつ reported_flag なし（同上）
 */
function marketAutoConfirm() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const orderSheet = mktGetSheet_(ss, "market_orders");
  const orderValues = getValuesSafe_(orderSheet);
  if (orderValues.length < 2) return;

  const oHeader = orderValues[0];
  const oIdx = indexMap_(oHeader);
  const oRows = orderValues.slice(1);

  const now = new Date();
  const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;

  for (var i = 0; i < oRows.length; i++) {
    const row = oRows[i];
    const status = str_(row[oIdx["status"]]);
    if (status !== "paid") continue;

    const paidAt = new Date(str_(row[oIdx["paid_at"]]));
    if (isNaN(paidAt.getTime())) continue;
    if ((now.getTime() - paidAt.getTime()) < sevenDaysMs) continue;

    // refund_requested / reported_flag 列があればチェック
    if (oIdx["refund_requested"] !== undefined && str_(row[oIdx["refund_requested"]]) === "true") continue;
    if (oIdx["reported_flag"] !== undefined && str_(row[oIdx["reported_flag"]]) === "true") continue;

    const orderId = str_(row[oIdx["order_id"]]);
    const rowNum = i + 2; // 1-indexed, +1 for header

    try {
      // market_confirm と同等の処理
      const currency   = str_(row[oIdx["currency"]]);
      const price      = num_(row[oIdx["price"]]);
      const feeAmount  = num_(row[oIdx["fee_amount"]]);
      const sellerNet  = num_(row[oIdx["seller_net"]]);
      const sellerId   = str_(row[oIdx["seller_id"]]);

      // ordersシートのステータスを confirmed に更新
      orderSheet.getRange(rowNum, oIdx["status"] + 1).setValue("confirmed");
      orderSheet.getRange(rowNum, oIdx["confirmed_at"] + 1).setValue(now);
      orderSheet.getRange(rowNum, oIdx["updated_at"] + 1).setValue(now);

      // エスクロー解放
      const escrowSheet = mktGetSheet_(ss, "market_escrow");
      const escrowValues = getValuesSafe_(escrowSheet);
      if (escrowValues.length >= 2) {
        const eHeader = escrowValues[0];
        const eIdx = indexMap_(eHeader);
        const eRows = escrowValues.slice(1);
        for (var j = 0; j < eRows.length; j++) {
          if (str_(eRows[j][eIdx["order_id"]]) === orderId &&
              str_(eRows[j][eIdx["state"]]) === "held") {
            escrowSheet.getRange(j + 2, eIdx["state"] + 1).setValue("released");
            escrowSheet.getRange(j + 2, eIdx["updated_at"] + 1).setValue(now);
            break;
          }
        }
      }

      // 出品者へ報酬付与
      mktAdjustEp_(sellerId, "", sellerNet, "market_auto_confirm",
        "order=" + orderId + " auto_7days");

      // market_itemsのstock_sold更新
      const itemId = str_(row[oIdx["item_id"]]);
      const itemSheet = mktGetSheet_(ss, "market_items");
      const itemValues = getValuesSafe_(itemSheet);
      if (itemValues.length >= 2) {
        const iHeader = itemValues[0];
        const iIdx = indexMap_(iHeader);
        const iRows = itemValues.slice(1);
        for (var k = 0; k < iRows.length; k++) {
          if (str_(iRows[k][iIdx["item_id"]]) === itemId) {
            const newSold = num_(iRows[k][iIdx["stock_sold"]]) + 1;
            const newReserved = Math.max(0, num_(iRows[k][iIdx["stock_reserved"]]) - 1);
            itemSheet.getRange(k + 2, iIdx["stock_sold"] + 1).setValue(newSold);
            itemSheet.getRange(k + 2, iIdx["stock_reserved"] + 1).setValue(newReserved);
            itemSheet.getRange(k + 2, iIdx["updated_at"] + 1).setValue(now);
            break;
          }
        }
      }

      Logger.log("marketAutoConfirm: confirmed order " + orderId);
    } catch(e) {
      Logger.log("marketAutoConfirm ERROR for order " + orderId + ": " + e.toString());
    }
  }
}

// ==============================
// marketAutoConfirm trigger セットアップ
// ==============================

/**
 * この関数を一度だけ手動実行すると、
 * marketAutoConfirm が毎日AM3時に自動実行されるtriggerが登録される。
 * 二重登録を防ぐため、既存のtriggerがあれば削除してから再登録する。
 */
function setupMarketAutoConfirmTrigger() {
  // 既存のmarketAutoConfirmトリガーを削除
  const triggers = ScriptApp.getProjectTriggers();
  for (var i = 0; i < triggers.length; i++) {
    if (triggers[i].getHandlerFunction() === "marketAutoConfirm") {
      ScriptApp.deleteTrigger(triggers[i]);
    }
  }
  // 毎日AM3時（JST）に実行
  ScriptApp.newTrigger("marketAutoConfirm")
    .timeBased()
    .everyDays(1)
    .atHour(3)
    .create();
  Logger.log("marketAutoConfirm trigger set: daily at 3AM");
}

// ==============================
// Market Helper Functions
// ==============================

// シートを取得（無ければヘッダー付きで作成）
function mktGetSheet_(ss, name) {
  const HEADERS = {
    "market_items": [
      "item_id", "seller_id", "seller_name", "title", "desc", "item_type",
      "asset_count", "currency", "price", "fee_rate", "delivery_mode", "delivery_ref",
      "stock_total", "stock_sold", "stock_reserved", "status", "report_count",
      "created_at", "updated_at",
    ],
    "market_orders": [
      "order_id", "item_id", "buyer_id", "seller_id", "currency", "price",
      "fee_amount", "seller_net", "status", "reserved_until", "paid_at",
      "delivered_at", "confirmed_at", "refunded_at", "note", "created_at", "updated_at",
    ],
    "market_escrow": [
      "escrow_id", "order_id", "currency", "hold_amount", "state",
      "created_at", "updated_at",
    ],
    "market_reports": [
      "report_id", "item_id", "reporter_id", "reason", "message", "created_at",
    ],
    "market_daily_limits": [
      "user_id", "date_jst", "listed_count", "updated_at",
    ],
  };
  return getOrCreateSheetByName_(ss, name, HEADERS[name] || []);
}

// market_items 行 → 公開用オブジェクト（delivery_ref は含まない）
function mktRowToItem_(row, idx) {
  const KEYS = [
    "item_id", "seller_id", "seller_name", "title", "desc", "item_type",
    "asset_count", "currency", "price", "fee_rate", "delivery_mode",
    "stock_total", "stock_sold", "stock_reserved", "status", "report_count",
    "created_at", "updated_at",
  ];
  const obj = {};
  KEYS.forEach(function(k) {
    if (idx[k] !== undefined) obj[k] = row[idx[k]];
  });
  return obj;
}

// HMAC-SHA256 認証（login と同仕様）
function mktAuth_(SECRET, id, code) {
  try {
    const sheet = getOrCreateSheet_();
    const values = getValuesSafe_(sheet);
    if (values.length < 2) return { ok: false, reason: "no_data" };

    const header = values[0];
    const idx = indexMap_(header);
    const rows = values.slice(1);

    for (var i = 0; i < rows.length; i++) {
      const r = rows[i];
      const loginId = str_(r[idx["login_id"]]);
      const email = str_(r[idx["email"]]);
      if (id !== loginId && id !== email) continue;

      const status = str_(r[idx["status"]]);
      if (status !== "approved") return { ok: false, reason: "not_approved" };

      const pwHashSaved = str_(r[idx["pw_hash"]]);
      const pwHashInput = hmacSha256Hex_(SECRET, loginId + ":" + code);
      if (pwHashInput !== pwHashSaved) return { ok: false, reason: "invalid_password" };

      return {
        ok: true,
        login_id: loginId,
        email: email,
        name: idx["name"] !== undefined ? str_(r[idx["name"]]) : "",
        ep_balance: idx["ep_balance"] !== undefined ? num_(r[idx["ep_balance"]]) : 0,
        bp_balance: idx["bp_balance"] !== undefined ? num_(r[idx["bp_balance"]]) : 0,
      };
    }
    return { ok: false, reason: "not_found" };
  } catch (e) {
    return { ok: false, reason: String(e) };
  }
}

// login_id でユーザー情報を取得
function mktGetUserByLoginId_(loginId) {
  try {
    const sheet = getOrCreateSheet_();
    const values = getValuesSafe_(sheet);
    if (values.length < 2) return null;

    const header = values[0];
    const idx = indexMap_(header);
    const rows = values.slice(1);

    for (var i = 0; i < rows.length; i++) {
      if (str_(rows[i][idx["login_id"]]) === loginId) {
        return {
          login_id: loginId,
          email: idx["email"] !== undefined ? str_(rows[i][idx["email"]]) : "",
          ep_balance: idx["ep_balance"] !== undefined ? num_(rows[i][idx["ep_balance"]]) : 0,
          rowIndex: i + 2,
        };
      }
    }
    return null;
  } catch (e) {
    return null;
  }
}

// EP残高を増減し wallet_ledger に記録
function mktAdjustEp_(loginId, email, delta, kind, memo) {
  try {
    const sheet = getOrCreateSheet_();
    const values = getValuesSafe_(sheet);
    if (values.length < 2) return { ok: false, error: "no_data" };

    const header = values[0];
    const idx = indexMap_(header);
    const rows = values.slice(1);

    for (var i = 0; i < rows.length; i++) {
      if (str_(rows[i][idx["login_id"]]) === loginId) {
        const rowIndex = i + 2;
        const curEp = num_(sheet.getRange(rowIndex, idx["ep_balance"] + 1).getValue());
        const newEp = curEp + delta;
        sheet.getRange(rowIndex, idx["ep_balance"] + 1).setValue(newEp);
        try {
          appendWalletLedger_({
            ts: new Date(),
            kind: kind,
            login_id: loginId,
            email: email || str_(rows[i][idx["email"]]),
            amount: delta,
            memo: memo || "",
          });
        } catch (e2) {}
        return { ok: true, new_balance: newEp };
      }
    }
    return { ok: false, error: "user_not_found" };
  } catch (e) {
    return { ok: false, error: String(e) };
  }
}

// JST での今日の日付文字列 "YYYY-MM-DD"
function mktTodayJst_() {
  const now = new Date();
  const jst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  const y = jst.getUTCFullYear();
  const m = String(jst.getUTCMonth() + 1).padStart(2, "0");
  const d = String(jst.getUTCDate()).padStart(2, "0");
  return y + "-" + m + "-" + d;
}

// 当日の出品数を取得
function mktGetDailyListCount_(limitSheet, userId, dateJst) {
  const values = getValuesSafe_(limitSheet);
  if (values.length < 2) return 0;

  const header = values[0];
  const idx = indexMap_(header);
  const rows = values.slice(1);

  for (var i = 0; i < rows.length; i++) {
    if (str_(rows[i][idx["user_id"]]) === userId &&
        str_(rows[i][idx["date_jst"]]) === dateJst) {
      return num_(rows[i][idx["listed_count"]]);
    }
  }
  return 0;
}

// 当日の出品数をインクリメント（行が無ければ新規追加）
function mktIncrDailyListCount_(limitSheet, userId, dateJst) {
  const values = getValuesSafe_(limitSheet);
  const now = new Date();

  if (values.length >= 2) {
    const header = values[0];
    const idx = indexMap_(header);
    const rows = values.slice(1);

    for (var i = 0; i < rows.length; i++) {
      if (str_(rows[i][idx["user_id"]]) === userId &&
          str_(rows[i][idx["date_jst"]]) === dateJst) {
        const rowIndex = i + 2;
        const curCount = num_(rows[i][idx["listed_count"]]);
        limitSheet.getRange(rowIndex, idx["listed_count"] + 1).setValue(curCount + 1);
        limitSheet.getRange(rowIndex, idx["updated_at"] + 1).setValue(now);
        return;
      }
    }
  }

  // 新規行
  limitSheet.appendRow([userId, dateJst, 1, now]);
}

// ============================================
// 売却申請・BP付与 関連（追記）
// ============================================

// SellRequestsシート取得（なければ作成）
function getSellRequestsSheet_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName('SellRequests');
  if (!sheet) {
    sheet = ss.insertSheet('SellRequests');
    sheet.appendRow(['request_id','item_id','seller_id','status','bp_amount','requested_at','granted_at']);
  }
  return sheet;
}

// PendingBPシート取得（なければ作成）
function getPendingBPSheet_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName('PendingBP');
  if (!sheet) {
    sheet = ss.insertSheet('PendingBP');
    sheet.appendRow(['user_id','bp_amount','created_at','claimed']);
  }
  return sheet;
}

// 1. 売却申請
function handle_sell_request_(data) {
  const item_id = str_(data.item_id);
  const seller_id = str_(data.seller_id);
  if (!item_id || !seller_id) return { ok: false, error: 'missing params' };
  const sheet = getSellRequestsSheet_();
  const request_id = 'sr_' + new Date().getTime();
  sheet.appendRow([request_id, item_id, seller_id, 'pending', '', new Date().toISOString(), '']);
  return { ok: true, request_id: request_id };
}

// 2. 申請一覧取得（admin用）
function handle_get_sell_requests_(data) {
  const secrets = getSecrets_();
  if (str_(data.adminKey) !== secrets.ADMIN_SECRET) return { ok: false, error: 'admin_unauthorized' };
  const sheet = getSellRequestsSheet_();
  const rows = sheet.getDataRange().getValues();
  const headers = rows[0];
  const result = rows.slice(1).map(function(r) {
    const obj = {};
    headers.forEach(function(h, i) { obj[h] = r[i]; });
    return obj;
  });
  return { ok: true, requests: result };
}

// 3. BP付与（admin用）
function handle_grant_bp_for_sell_(data) {
  const secrets = getSecrets_();
  if (str_(data.adminKey) !== secrets.ADMIN_SECRET) return { ok: false, error: 'admin_unauthorized' };
  const request_id = str_(data.request_id);
  const user_id = str_(data.user_id);
  const bp_amount = num_(data.bp_amount);
  if (!request_id || !user_id || !bp_amount) return { ok: false, error: 'missing params' };

  // SellRequestsのステータス更新
  const sheet = getSellRequestsSheet_();
  const rows = sheet.getDataRange().getValues();
  for (var i = 1; i < rows.length; i++) {
    if (str_(rows[i][0]) === request_id) {
      sheet.getRange(i + 1, 4).setValue('granted');
      sheet.getRange(i + 1, 5).setValue(bp_amount);
      sheet.getRange(i + 1, 7).setValue(new Date().toISOString());
      break;
    }
  }

  // PendingBPに追加
  const pendingSheet = getPendingBPSheet_();
  pendingSheet.appendRow([user_id, bp_amount, new Date().toISOString(), false]);

  return { ok: true };
}

// 4. 未受取BP確認
function handle_get_pending_bp_(data) {
  const user_id = str_(data.user_id || data.id);
  if (!user_id) return { ok: false, error: 'missing user_id' };
  const sheet = getPendingBPSheet_();
  const rows = sheet.getDataRange().getValues();
  for (var i = 1; i < rows.length; i++) {
    if (String(rows[i][0]) === String(user_id) && rows[i][3] === false) {
      return { ok: true, hasPending: true, amount: rows[i][1] };
    }
  }
  return { ok: true, hasPending: false, amount: 0 };
}

// 5. BP受取完了
function handle_claim_pending_bp_(data) {
  const user_id = str_(data.user_id || data.id);
  if (!user_id) return { ok: false, error: 'missing user_id' };
  const sheet = getPendingBPSheet_();
  const rows = sheet.getDataRange().getValues();
  for (var i = 1; i < rows.length; i++) {
    if (String(rows[i][0]) === String(user_id) && rows[i][3] === false) {
      sheet.getRange(i + 1, 4).setValue(true);
      break;
    }
  }
  return { ok: true };
}

// ---- doPost 再定義（sell_request 系アクションを追加ルーティング）----
// ✅ market_ は引き続き handleMarket_ へ、新規アクションを追加、既存は handle_ へ
function doPost(e) {
  try {
    const key = pickKey_(e);
    const body = JSON.parse(e?.postData?.contents || "{}");
    const action = str_(body.action);
    if (action && action.startsWith("market_")) {
      return handleMarket_(key, body);
    }
    if (action && action.startsWith("gift_")) {
      return handleGift_(key, body);
    }
    if (action === 'sell_request')      return json_(handle_sell_request_(body));
    if (action === 'get_sell_requests') return json_(handle_get_sell_requests_(body));
    if (action === 'grant_bp_for_sell') return json_(handle_grant_bp_for_sell_(body)); // ✅ 追記
    if (action === 'get_pending_bp')    return json_(handle_get_pending_bp_(body));
    if (action === 'claim_pending_bp')  return json_(handle_claim_pending_bp_(body));
    if (action === 'create_music_job') return createMusicJob_(body);
    if (action === 'get_music_job')    return getMusicJob_(body);
    if (action === 'update_music_job') return updateMusicJob_(body);
    if (action === 'tap_play')    return tapPlay_(body);
    if (action === 'tap_status')  return tapStatus_(body);
    if (action === 'tap_ranking') return tapRanking_(body);
    if (action === 'tap_ticker')     return tapTicker_(body);
    if (action === 'tap_batch_play') return tapBatchPlay_(body);
    if (action === 'rumble_entry')   return rumbleEntry_(body);
    if (action === 'rumble_ranking')   return rumbleRanking_(body);
    if (action === 'rumble_status')    return rumbleStatus_(body);
    if (action === 'rumble_gacha')     return rumbleGacha_(body);
    if (action === 'rumble_equipment') return rumbleEquipment_(body);
    if (action === 'rumble_equip')     return rumbleEquip_(body);
    if (action === 'rumble_reward_distribute') return rumbleRewardDistribute_(body);
    if (action === 'rumble_dismantle')         return rumbleDismantle_(body);
    if (action === 'rumble_enhance')           return rumbleEnhance_(body);
    if (action === 'rumble_my_rank_context')   return rumbleMyRankContext_(body);
    if (action === 'rumble_shard_status')      return rumbleShardStatus_(body);
    if (action === 'rumble_set_display_name')  return rumbleSetDisplayName_(body);
    if (action === 'rumble_spectator')         return rumbleSpectator_(body);
    if (action === 'rumble_daily_lottery')     return rumbleDailyLottery_(body);
    if (action === 'rumble_daily_result')      return rumbleDailyResult_(body);
    if (action === 'rumble_force_entry')       return rumbleForceEntry_(body);
    if (action === 'rumble_force_start')       return rumbleForceStart_(body);
    if (action === 'rumble_run_now')           return rumbleRunNow_(body);
    if (action === 'music_boost_status')     return musicBoostStatus_(body);
    if (action === 'music_boost_subscribe')  return musicBoostSubscribe_(body);
    if (action === 'music_boost_cancel')     return musicBoostCancel_(body);
    if (action === 'music_boost_admin_list') return musicBoostAdminList_(body);
    if (action === 'music_boost_get_info')    return musicBoostGetInfo_(body);
    if (action === 'music_boost_update_info') return musicBoostUpdateInfo_(body);
    if (action === 'music_boost_set_tracks')  return musicBoostSetTracks_(body);
    if (action === 'cat_log_create')     return catLogCreate_(body);
    if (action === 'cat_log_feedback')   return catLogFeedback_(body);
    if (action === 'cat_faq_list')       return catFaqList_(body);
    if (action === 'cat_unknown_upsert') return catUnknownUpsert_(body);
    if (action === 'bp_lock')        return imageBpLock_(body);
    if (action === 'bp_commit')      return imageBpCommit_(body);
    if (action === 'bp_refund')      return imageBpRefund_(body);
    if (action === 'image_log')      return imageLog_(body);
    if (action === 'image_history')  return imageHistory_(body);
    if (action === 'music_history_save') return musicHistorySave_(body);
    if (action === 'music_history_list') return musicHistoryList_(body);

  // =========================================================
  // MONITOR ACTIONS（監視ダッシュボード用 — 追加のみ、既存コード無変更）
  // =========================================================
  if (action === 'monitor_song_stats')   return json_(monitorSongStats_());
  if (action === 'monitor_games_stats')  return json_(monitorGamesStats_());
  if (action === 'monitor_market_stats') return json_(monitorMarketStats_());
  if (action === 'monitor_wallet_stats')       return json_(monitorWalletStats_());
  if (action === 'monitor_boost_subscribers')  return json_(monitorBoostSubscribers_());
  if (action === 'monitor_rumble_today')       return json_(monitorRumbleToday_());
  if (action === 'monitor_rumble_daily')       return json_(monitorRumbleDaily_());
  if (action === 'monitor_rumble_weekly')      return json_(monitorRumbleWeekly_());
  if (action === 'monitor_rumble_spectator')   return json_(monitorRumbleSpectator_());

  // =========================================================
  // narasu代理申請 submit
  // =========================================================
  if (action === "narasu_agency_submit") {
    try {
      var narasuSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("narasu_agency");
      if (!narasuSheet) {
        narasuSheet = SpreadsheetApp.getActiveSpreadsheet().insertSheet("narasu_agency");
        narasuSheet.appendRow([
          "request_id", "created_at", "status",
          "narasu_login_id", "narasu_password",
          "audio_urls", "lyrics_text",
          "jacket_image_url", "jacket_note",
          "artist_name", "note",
          "agreed_terms_version", "agreed_at",
          "admin_memo"
        ]);
      }
      var requestId = "NA-" + Date.now();
      var now = new Date().toISOString();
      narasuSheet.appendRow([
        requestId,
        now,
        "submitted",
        str_(body.narasu_login_id),
        "[OMITTED]",
        str_(body.audio_urls),
        str_(body.lyrics_text),
        str_(body.jacket_image_url),
        str_(body.jacket_note),
        str_(body.artist_name),
        str_(body.note),
        str_(body.agreed_terms_version),
        str_(body.agreed_at),
        ""
      ]);
      // パスワードはシートに保存せず管理者メールのみに送信
      try {
        var adminEmail = PropertiesService.getScriptProperties().getProperty('ADMIN_EMAIL') || '';
        if (adminEmail) {
          MailApp.sendEmail(adminEmail,
            '[LIFAI] narasu申請 ' + requestId + ' ログイン情報',
            'requestId: ' + requestId + '\nloginId: ' + str_(body.narasu_login_id) + '\npassword: ' + str_(body.narasu_password));
        }
      } catch(mailErr) {
        Logger.log('[narasu_agency_submit] email送信失敗: ' + String(mailErr));
      }
      Logger.log("[narasu_agency_submit] saved: " + requestId);
      return json_({ ok: true, requestId: requestId });
    } catch (e) {
      Logger.log("[narasu_agency_submit] error: " + String(e));
      return json_({ ok: false, error: String(e) });
    }
  }
    return handle_(key, body);
  } catch (err) {
    return json_({ ok: false, error: String(err) });
  }
}

// ---- market_list seller_id フィルター（handleMarket_ 内 market_list の filtered 後に相当する処理を独立関数で提供）----
// ✅ filtered は const のため再代入不可。market_listのGET側でseller_idを渡す場合はクエリで絞る
// ✅ doGet 再定義でseller_idをbodyに渡すよう追記
function doGet(e) {
  try {
    const key = pickKey_(e);
    const action = str_(e?.parameter?.action);

    if (!action) {
      return json_({ ok: false, error: "method_not_allowed" });
    }

    if (action.startsWith("market_")) {
      const body = {
        action,
        id: str_(e?.parameter?.id),
        code: str_(e?.parameter?.code),
        item_id: str_(e?.parameter?.item_id),
        order_id: str_(e?.parameter?.order_id),
        reason: str_(e?.parameter?.reason),
        message: str_(e?.parameter?.message),
        status: str_(e?.parameter?.status),
        item_type: str_(e?.parameter?.item_type),
        currency: str_(e?.parameter?.currency),
        page: str_(e?.parameter?.page),
        limit: str_(e?.parameter?.limit),
        adminKey: str_(e?.parameter?.adminKey),
        note: str_(e?.parameter?.note),
        seller_id: str_(e?.parameter?.seller_id),
      };
      return handleMarket_(key, body);
    }

    if (action === 'get_sell_requests') return json_(handle_get_sell_requests_({}));
    if (action === 'get_pending_bp')    return json_(handle_get_pending_bp_({ id: str_(e?.parameter?.id) }));

    const pseudoBody = {
      action,
      adminKey: str_(e?.parameter?.adminKey),
      rowIndex: num_(e?.parameter?.rowIndex),
      id: str_(e?.parameter?.id),
      code: str_(e?.parameter?.code),
      plan: str_(e?.parameter?.plan),
      email: str_(e?.parameter?.email),
      name: str_(e?.parameter?.name),
      nameKana: str_(e?.parameter?.nameKana),
      discordId: str_(e?.parameter?.discordId),
      ageBand: str_(e?.parameter?.ageBand),
      prefecture: str_(e?.parameter?.prefecture),
      city: str_(e?.parameter?.city),
      job: str_(e?.parameter?.job),
      refName: str_(e?.parameter?.refName),
      refId: str_(e?.parameter?.refId),
      refCode: str_(e?.parameter?.refCode),
      region: str_(e?.parameter?.region),
      applyId: str_(e?.parameter?.applyId),
      orderId: str_(e?.parameter?.orderId),
      paymentStatus: str_(e?.parameter?.paymentStatus),
      isPaid: str_(e?.parameter?.isPaid),
      invoiceId: str_(e?.parameter?.invoiceId),
      actuallyPaid: str_(e?.parameter?.actuallyPaid),
      payAmount: str_(e?.parameter?.payAmount),
      payCurrency: str_(e?.parameter?.payCurrency),
      priceAmount: str_(e?.parameter?.priceAmount),
      priceCurrency: str_(e?.parameter?.priceCurrency),
      token: str_(e?.parameter?.token),
      password: str_(e?.parameter?.password),
    };

    return handle_(key, pseudoBody);
  } catch (err) {
    return json_({ ok: false, error: String(err) });
  }
}

// ✅ market_list の seller_id フィルターは handleMarket_ 側の対応待ち

/**
 * 手動実行用：approved かつ reset_sent_at が空のユーザーを全員再送
 * GASエディタから直接実行する
 */
function __rescueAllPendingMail() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('applies');
  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  const idx = indexMap_(headers);

  const col = (name) => headers.indexOf(name);
  let sent = 0, skipped = 0, failed = 0;

  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    const status = row[col('status')];
    const email = row[col('email')];
    const resetSentAt = row[col('reset_sent_at')];
    const pwHash = row[col('pw_hash')];

    if (status === 'approved' && !resetSentAt && !pwHash && email) {
      Logger.log('[rescue] 対象: row=' + (i+1) + ' email=' + email);
      try {
        approveRowCore_(sheet, headers, idx, i + 1, 'rescue_resend');
        Logger.log('[rescue] 送信成功: ' + email);
        sent++;
        Utilities.sleep(1500);
      } catch(e) {
        Logger.log('[rescue] 送信失敗: ' + email + ' / ' + e);
        failed++;
      }
    } else {
      skipped++;
    }
  }

  Logger.log('[rescue] 完了 sent=' + sent + ' failed=' + failed + ' skipped=' + skipped);
}
// doGet から seller_id をbodyに含めて渡しているため、GAS側でフィルター対応後に自動で有効になる

// ============================================================
// MUSIC JOB STORE（song_jobs シートによるジョブ永続化）
// 追加日: 2026-03 / 後加工パイプライン対応: 2026-03
// ============================================================

// song_jobs 全列定義（順序固定）
var MUSIC_JOB_COLS_ = [
  "job_id", "user_id", "status", "stage",
  "lyrics_data", "structure_data", "prompt",
  "audio_url", "download_url", "error",
  "bp_locked", "bp_final", "rights_log",
  // 後加工パイプライン追加列
  "raw_audio_url", "processed_audio_url",
  "postprocess_status", "postprocess_preset", "postprocess_version",
  "analysis_json",
  "postprocess_started_at", "postprocess_completed_at", "postprocess_error",
  "final_lufs", "final_peak_db", "humanize_level",
  // 歌詞パイプライン列（Phase 1〜）
  "master_lyrics", "singable_lyrics", "asr_lyrics",
  "display_lyrics", "distribution_lyrics",
  "lyrics_match_score", "lyrics_review_required", "distribution_ready",
  "lyrics_source", "asr_status",
  // ASR Phase 2 追加列
  "asr_error", "asr_started_at", "asr_completed_at",
  "lyrics_diff_json", "lyrics_timestamps_json",
  "created_at", "updated_at"
];

function getMusicJobSheet_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName("song_jobs");
  if (!sheet) sheet = ss.insertSheet("song_jobs");
  return sheet;
}

// 新規シートはヘッダー行を一括追加
// 既存シートは不足列を末尾に自動マイグレーション（既存データは壊さない）
function ensureMusicJobCols_(sheet) {
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(MUSIC_JOB_COLS_);
    return;
  }
  var existing = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0]
    .map(function(h) { return String(h); });
  var missingCols = [];
  MUSIC_JOB_COLS_.forEach(function(col) {
    if (existing.indexOf(col) === -1) {
      sheet.getRange(1, existing.length + 1).setValue(col);
      existing.push(col);
      missingCols.push(col);
    }
  });
  if (missingCols.length > 0) {
    Logger.log('song_jobs: added missing columns: ' + missingCols.join(', '));
  }
}

// action: create_music_job
// params: jobId, userId, prompt, bpLocked
function createMusicJob_(params) {
  var sheet = getMusicJobSheet_();
  ensureMusicJobCols_(sheet);
  var now = new Date().toISOString();
  // ヘッダー順に値をマップして appendRow（列追加に強い）
  var headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0]
    .map(function(h) { return String(h); });
  var defaults = {
    "job_id":                   params.jobId,
    "user_id":                  params.userId || "",
    "status":                   "lyrics_generating",
    "stage":                    "",
    "lyrics_data":              "",
    "structure_data":           "",
    "prompt":                   JSON.stringify(params.prompt || {}),
    "audio_url":                "",
    "download_url":             "",
    "error":                    "",
    "bp_locked":                params.bpLocked || 0,
    "bp_final":                 0,
    "rights_log":               "",
    "raw_audio_url":            "",
    "processed_audio_url":      "",
    "postprocess_status":       "pending",
    "postprocess_preset":       "",
    "postprocess_version":      "",
    "analysis_json":            "",
    "postprocess_started_at":   "",
    "postprocess_completed_at": "",
    "postprocess_error":        "",
    "final_lufs":               "",
    "final_peak_db":            "",
    "humanize_level":           0,
    // 歌詞パイプライン
    "master_lyrics":            "",
    "singable_lyrics":          "",
    "asr_lyrics":               "",
    "display_lyrics":           "",
    "distribution_lyrics":      "",
    "lyrics_match_score":       "",
    "lyrics_review_required":   true,
    "distribution_ready":       false,
    "lyrics_source":            "singable",
    "asr_status":               "pending",
    "asr_error":                "",
    "asr_started_at":           "",
    "asr_completed_at":         "",
    "lyrics_diff_json":         "",
    "lyrics_timestamps_json":   "",
    "created_at":               now,
    "updated_at":               now
  };
  var row = headers.map(function(h) {
    return defaults[h] !== undefined ? defaults[h] : "";
  });
  sheet.appendRow(row);
  return json_({ ok: true, jobId: params.jobId });
}

// action: get_music_job
// params: jobId
function getMusicJob_(params) {
  var sheet = getMusicJobSheet_();
  ensureMusicJobCols_(sheet);
  var data = sheet.getDataRange().getValues();
  var headers = data[0];
  var idx = {};
  headers.forEach(function(h, i) { idx[h] = i; });
  for (var i = 1; i < data.length; i++) {
    if (String(data[i][idx["job_id"]]) === String(params.jobId)) {
      var row = data[i];
      function col_(name) { return idx[name] !== undefined ? row[idx[name]] : ""; }
      function safeJson_(s) { try { return s ? JSON.parse(s) : null; } catch(e) { return null; } }
      function safeNum_(s) { var n = parseFloat(s); return isNaN(n) ? null : n; }
      return json_({
        ok:                     true,
        jobId:                  col_("job_id"),
        userId:                 col_("user_id"),
        status:                 col_("status"),
        stage:                  col_("stage"),
        lyricsData:             safeJson_(col_("lyrics_data")),
        structureData:          safeJson_(col_("structure_data")),
        prompt:                 safeJson_(col_("prompt")) || {},
        audioUrl:               col_("audio_url")       || null,
        downloadUrl:            col_("download_url")    || null,
        error:                  col_("error")           || null,
        bpLocked:               col_("bp_locked"),
        bpFinal:                col_("bp_final"),
        rightsLog:              safeJson_(col_("rights_log")),
        // 後加工パイプライン
        rawAudioUrl:            col_("raw_audio_url")            || null,
        processedAudioUrl:      col_("processed_audio_url")      || null,
        postprocessStatus:      col_("postprocess_status")       || null,
        postprocessPreset:      col_("postprocess_preset")       || null,
        postprocessVersion:     col_("postprocess_version")      || null,
        analysisJson:           col_("analysis_json")            || null,
        postprocessStartedAt:   col_("postprocess_started_at")   || null,
        postprocessCompletedAt: col_("postprocess_completed_at") || null,
        postprocessError:       col_("postprocess_error")        || null,
        finalLufs:              safeNum_(col_("final_lufs")),
        finalPeakDb:            safeNum_(col_("final_peak_db")),
        humanizeLevel:          safeNum_(col_("humanize_level")),
        // 歌詞パイプライン
        masterLyrics:           col_("master_lyrics")           || null,
        singableLyrics:         col_("singable_lyrics")         || null,
        asrLyrics:              col_("asr_lyrics")              || null,
        displayLyrics:          col_("display_lyrics")          || null,
        distributionLyrics:     col_("distribution_lyrics")     || null,
        lyricsMatchScore:       safeNum_(col_("lyrics_match_score")),
        lyricsReviewRequired:   col_("lyrics_review_required") !== false && col_("lyrics_review_required") !== "false",
        distributionReady:      col_("distribution_ready") === true || col_("distribution_ready") === "true",
        lyricsSource:           col_("lyrics_source")           || "singable",
        asrStatus:              col_("asr_status")              || null,
        asrError:               col_("asr_error")               || null,
        asrStartedAt:           col_("asr_started_at")          || null,
        asrCompletedAt:         col_("asr_completed_at")        || null,
        lyricsDiffJson:         col_("lyrics_diff_json")        || null,
        lyricsTimestampsJson:   col_("lyrics_timestamps_json")  || null,
        createdAt:              col_("created_at"),
        updatedAt:              col_("updated_at")
      });
    }
  }
  return json_({ ok: false, error: "job_not_found" });
}

// action: update_music_job
// params: jobId, fields（更新したいキーのみ）
function updateMusicJob_(params) {
  var sheet = getMusicJobSheet_();
  ensureMusicJobCols_(sheet);
  var data = sheet.getDataRange().getValues();
  var headers = data[0];
  var idx = {};
  headers.forEach(function(h, i) { idx[h] = i; });
  for (var i = 1; i < data.length; i++) {
    if (String(data[i][idx["job_id"]]) === String(params.jobId)) {
      var rowNum = i + 1;
      var fields = params.fields || {};
      var colMap = {
        status:                 "status",
        stage:                  "stage",
        lyricsData:             "lyrics_data",
        structureData:          "structure_data",
        audioUrl:               "audio_url",
        downloadUrl:            "download_url",
        error:                  "error",
        bpFinal:                "bp_final",
        rightsLog:              "rights_log",
        // 後加工パイプライン
        rawAudioUrl:            "raw_audio_url",
        processedAudioUrl:      "processed_audio_url",
        postprocessStatus:      "postprocess_status",
        postprocessPreset:      "postprocess_preset",
        postprocessVersion:     "postprocess_version",
        analysisJson:           "analysis_json",
        postprocessStartedAt:   "postprocess_started_at",
        postprocessCompletedAt: "postprocess_completed_at",
        postprocessError:       "postprocess_error",
        finalLufs:              "final_lufs",
        finalPeakDb:            "final_peak_db",
        humanizeLevel:          "humanize_level",
        // 歌詞パイプライン
        masterLyrics:           "master_lyrics",
        singableLyrics:         "singable_lyrics",
        asrLyrics:              "asr_lyrics",
        displayLyrics:          "display_lyrics",
        distributionLyrics:     "distribution_lyrics",
        lyricsMatchScore:       "lyrics_match_score",
        lyricsReviewRequired:   "lyrics_review_required",
        distributionReady:      "distribution_ready",
        lyricsSource:           "lyrics_source",
        asrStatus:              "asr_status",
        asrError:               "asr_error",
        asrStartedAt:           "asr_started_at",
        asrCompletedAt:         "asr_completed_at",
        lyricsDiffJson:         "lyrics_diff_json",
        lyricsTimestampsJson:   "lyrics_timestamps_json"
      };
      Object.keys(fields).forEach(function(key) {
        if (colMap[key] !== undefined && idx[colMap[key]] !== undefined) {
          var val = fields[key];
          if (typeof val === "object" && val !== null) val = JSON.stringify(val);
          sheet.getRange(rowNum, idx[colMap[key]] + 1).setValue(val);
        }
      });
      sheet.getRange(rowNum, idx["updated_at"] + 1).setValue(new Date().toISOString());
      return json_({ ok: true });
    }
  }
  return json_({ ok: false, error: "job_not_found" });
}

// ============================================================
// TAP MINING GAME（tap_game / tap_logs シートによる管理）
// 追加日: 2026-03 / 既存コードへの変更なし・追記のみ
// ============================================================

function getTapGameSheet_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName("tap_game");
  if (!sheet) sheet = ss.insertSheet("tap_game");
  return sheet;
}

function getTapLogsSheet_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName("tap_logs");
  if (!sheet) sheet = ss.insertSheet("tap_logs");
  return sheet;
}

function ensureTapGameCols_(sheet) {
  if (sheet.getLastRow() > 0) return;
  sheet.appendRow([
    "user_id", "total_taps", "today_taps", "today_bp_earned",
    "today_ep_earned", "max_combo", "today_max_combo",
    "daily_reset_at", "last_tap_at", "suspicious_flag"
  ]);
}

function ensureTapLogsCols_(sheet) {
  if (sheet.getLastRow() > 0) return;
  sheet.appendRow([
    "log_id", "user_id", "tapped_at", "reward_bp", "reward_ep",
    "combo_count", "fever_active", "reward_type"
  ]);
}

function getTapGameRow_(sheet, userId) {
  var data = sheet.getDataRange().getValues();
  var headers = data[0];
  var idx = {};
  headers.forEach(function(h, i) { idx[h] = i; });
  for (var i = 1; i < data.length; i++) {
    if (String(data[i][idx["user_id"]]) === String(userId)) {
      return { row: data[i], rowNum: i + 1, idx: idx };
    }
  }
  return null;
}

function resetTapIfNeeded_(sheet, rowNum, idx, row) {
  var nowJst = new Date(Date.now() + 9 * 60 * 60 * 1000);
  var todayStr = nowJst.toISOString().slice(0, 10);
  var rawReset = row[idx["daily_reset_at"]];
  var lastReset = "";
  if (rawReset instanceof Date) {
    var jstReset = new Date(rawReset.getTime() + 9 * 60 * 60 * 1000);
    lastReset = jstReset.toISOString().slice(0, 10);
  } else {
    lastReset = String(rawReset || "").slice(0, 10);
  }
  if (lastReset !== todayStr) {
    sheet.getRange(rowNum, idx["today_taps"] + 1).setValue(0);
    sheet.getRange(rowNum, idx["today_bp_earned"] + 1).setValue(0);
    sheet.getRange(rowNum, idx["today_ep_earned"] + 1).setValue(0);
    sheet.getRange(rowNum, idx["today_max_combo"] + 1).setValue(0);
    sheet.getRange(rowNum, idx["daily_reset_at"] + 1).setValue(todayStr);
    return true;
  }
  return false;
}

// @deprecated: Use tapBatchPlay_ instead. Kept for debug/fallback/rollback only.
// action: tap_play
// params: userId
function tapPlay_(params) {
  var userId = String(params.userId || "");
  if (!userId) return json_({ ok: false, error: "userId_required" });

  var GAS_URL    = ScriptApp.getService().getUrl();
  var sheet      = getTapGameSheet_();
  ensureTapGameCols_(sheet);

  var nowJst   = new Date(Date.now() + 9 * 60 * 60 * 1000);
  var nowStr   = nowJst.toISOString();
  var todayStr = nowStr.slice(0, 10);

  var MAX_TAPS_PER_DAY = 500;

  // 報酬確率テーブル
  var REWARD_TABLE = [
    { type: "BP", amount: 0.1,   prob: 0.45     },
    { type: "BP", amount: 0.2,   prob: 0.25     },
    { type: "BP", amount: 0.5,   prob: 0.08     },
    { type: "EP", amount: 1,     prob: 0.15     },
    { type: "EP", amount: 3,     prob: 0.05     },
    { type: "EP", amount: 10,    prob: 0.015    },
    { type: "EP", amount: 100,   prob: 0.0009   },
    { type: "EP", amount: 10000, prob: 0.000001 }
  ];

  // ユーザー行取得
  var found = getTapGameRow_(sheet, userId);
  var rowNum, idx, row;

  if (!found) {
    sheet.appendRow([userId, 0, 0, 0, 0, 0, 0, todayStr, nowStr, false]);
    var data    = sheet.getDataRange().getValues();
    var headers = data[0];
    idx = {};
    headers.forEach(function(h, i) { idx[h] = i; });
    rowNum = sheet.getLastRow();
    row    = data[rowNum - 1];
  } else {
    rowNum = found.rowNum;
    idx    = found.idx;
    row    = found.row;
    resetTapIfNeeded_(sheet, rowNum, idx, row);
    row = sheet.getRange(rowNum, 1, 1, Object.keys(idx).length).getValues()[0];
  }

  var todayTaps = Number(row[idx["today_taps"]] || 0);
  var totalTaps = Number(row[idx["total_taps"]] || 0);

  // 1日上限チェック
  if (todayTaps >= MAX_TAPS_PER_DAY) {
    return json_({ ok: false, error: "daily_limit_reached", taps_remaining: 0 });
  }

  // BP残高確認（1BP消費）
  var appliesSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("applies");
  var appliesData  = appliesSheet.getDataRange().getValues();
  var aHeaders     = appliesData[0];
  var aIdx         = {};
  aHeaders.forEach(function(h, i) { aIdx[h] = i; });

  var userRow    = null;
  var userRowNum = -1;
  for (var i = 1; i < appliesData.length; i++) {
    if (String(appliesData[i][aIdx["login_id"]]) === userId) {
      userRow    = appliesData[i];
      userRowNum = i + 1;
      break;
    }
  }

  if (!userRow) return json_({ ok: false, error: "user_not_found" });

  var currentBp = Number(userRow[aIdx["bp_balance"]] || 0);
  if (currentBp < 1) return json_({ ok: false, error: "insufficient_bp", bp: currentBp });

  // BP -1消費
  var newBp = Math.round((currentBp - 1) * 100) / 100;
  appliesSheet.getRange(userRowNum, aIdx["bp_balance"] + 1).setValue(newBp);

  // 抽選
  var rand        = Math.random();
  var cumulative  = 0;
  var rewardType  = "BP";
  var rewardAmount = 0.1;
  var isRare      = false;

  for (var j = 0; j < REWARD_TABLE.length; j++) {
    cumulative += REWARD_TABLE[j].prob;
    if (rand < cumulative) {
      rewardType   = REWARD_TABLE[j].type;
      rewardAmount = REWARD_TABLE[j].amount;
      break;
    }
  }

  // is_rare判定（50EP以上）
  if (rewardType === "EP" && rewardAmount >= 50) isRare = true;

  // 報酬付与
  var beforeBp = newBp;
  var beforeEp = Number(userRow[aIdx["ep_balance"]] || 0);
  var afterBp  = beforeBp;
  var afterEp  = beforeEp;

  if (rewardType === "BP") {
    afterBp = Math.round((beforeBp + rewardAmount) * 100) / 100;
    appliesSheet.getRange(userRowNum, aIdx["bp_balance"] + 1).setValue(afterBp);
  } else {
    afterEp = Math.round((beforeEp + rewardAmount) * 100) / 100;
    appliesSheet.getRange(userRowNum, aIdx["ep_balance"] + 1).setValue(afterEp);
  }

  // tap_gameシート更新
  var newTodayTaps  = todayTaps + 1;
  var newTotalTaps  = totalTaps + 1;
  var todayBp       = Number(row[idx["today_bp_earned"]] || 0);
  var todayEp       = Number(row[idx["today_ep_earned"]] || 0);
  var newTodayBp    = rewardType === "BP" ? Math.round((todayBp + rewardAmount) * 100) / 100 : todayBp;
  var newTodayEp    = rewardType === "EP" ? Math.round((todayEp + rewardAmount) * 100) / 100 : todayEp;

  sheet.getRange(rowNum, idx["total_taps"]      + 1).setValue(newTotalTaps);
  sheet.getRange(rowNum, idx["today_taps"]      + 1).setValue(newTodayTaps);
  sheet.getRange(rowNum, idx["today_bp_earned"] + 1).setValue(newTodayBp);
  sheet.getRange(rowNum, idx["today_ep_earned"] + 1).setValue(newTodayEp);
  sheet.getRange(rowNum, idx["last_tap_at"]     + 1).setValue(nowStr);

  // tap_logsシート記録
  var logsSheet = getTapLogsSheet_();
  ensureTapLogsCols_(logsSheet);
  logsSheet.appendRow([
    Utilities.getUuid(), userId, nowStr,
    rewardType === "BP" ? rewardAmount : 0,
    rewardType === "EP" ? rewardAmount : 0,
    0, false, rewardType.toLowerCase()
  ]);

  // Ticker登録（50EP以上）
  if (isRare) {
    var tickerSheet = getOrCreateTickerSheet_();
    var maskedName  = userId.length > 2 ? userId.slice(0, 2) + "***" : userId + "***";
    tickerSheet.appendRow([
      Utilities.getUuid(), maskedName, rewardAmount, "EP", nowStr
    ]);
  }

  return json_({
    ok:             true,
    reward_type:    rewardType,
    reward_amount:  rewardAmount,
    is_rare:        isRare,
    bp:             afterBp,
    ep:             afterEp,
    taps_remaining: MAX_TAPS_PER_DAY - newTodayTaps,
    today_bp:       newTodayBp,
    today_ep:       newTodayEp,
  });
}

// action: tap_status
// params: userId
function tapStatus_(params) {
  var userId = String(params.userId || "");
  if (!userId) return json_({ ok: false, error: "userId_required" });

  var sheet = getTapGameSheet_();
  ensureTapGameCols_(sheet);

  var found = getTapGameRow_(sheet, userId);
  if (!found) {
    return json_({
      ok: true,
      today_taps: 0, today_bp: 0, today_ep: 0,
      taps_remaining: 500, max_combo: 0, total_taps: 0
    });
  }

  var rowNum = found.rowNum;
  var idx    = found.idx;
  var row    = found.row;
  resetTapIfNeeded_(sheet, rowNum, idx, row);
  row = sheet.getRange(rowNum, 1, 1, row.length).getValues()[0];

  return json_({
    ok: true,
    today_taps:      Number(row[idx["today_taps"]] || 0),
    today_bp:        Number(row[idx["today_bp_earned"]] || 0),
    today_ep:        Number(row[idx["today_ep_earned"]] || 0),
    taps_remaining:  500 - Number(row[idx["today_taps"]] || 0),
    max_combo:       Number(row[idx["max_combo"]] || 0),
    today_max_combo: Number(row[idx["today_max_combo"]] || 0),
    total_taps:      Number(row[idx["total_taps"]] || 0),
  });
}

// action: tap_ranking
function tapRanking_(params) {
  var sheet = getTapGameSheet_();
  ensureTapGameCols_(sheet);
  var data = sheet.getDataRange().getValues();
  if (data.length <= 1) return json_({ ok: true, ranking: [] });

  var headers = data[0];
  var idx = {};
  headers.forEach(function(h, i) { idx[h] = i; });

  var rows = data.slice(1).map(function(row) {
    return {
      user_id:    String(row[idx["user_id"]]),
      today_taps: Number(row[idx["today_taps"]] || 0),
      today_bp:   Number(row[idx["today_bp_earned"]] || 0),
    };
  });

  rows.sort(function(a, b) { return b.today_taps - a.today_taps; });
  var top10 = rows.slice(0, 10);

  return json_({ ok: true, ranking: top10 });
}

function getOrCreateTickerSheet_() {
  var ss    = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName("tap_ticker");
  if (!sheet) {
    sheet = ss.insertSheet("tap_ticker");
    sheet.appendRow(["id", "masked_name", "reward", "type", "created_at"]);
  }
  return sheet;
}

// action: tap_ticker
function tapTicker_(params) {
  var sheet = getOrCreateTickerSheet_();
  var data  = sheet.getDataRange().getValues();
  if (data.length <= 1) return json_({ ok: true, events: [] });

  var headers = data[0];
  var idx     = {};
  headers.forEach(function(h, i) { idx[h] = i; });

  // 直近20件を新しい順で返す
  var rows = data.slice(1).map(function(row) {
    return {
      masked_name: String(row[idx["masked_name"]]),
      reward:      Number(row[idx["reward"]]),
      type:        String(row[idx["type"]]),
      created_at:  String(row[idx["created_at"]]),
    };
  });
  rows.sort(function(a, b) { return b.created_at > a.created_at ? 1 : -1; });
  return json_({ ok: true, events: rows.slice(0, 20) });
}

function getTapBatchLogsSheet_() {
  var ss    = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName("tap_batch_logs");
  if (!sheet) {
    sheet = ss.insertSheet("tap_batch_logs");
    sheet.appendRow([
      "session_id", "user_id",
      "requested_tap_count", "processed_tap_count",
      "bp_cost", "bp_reward", "ep_reward",
      "rare_count", "max_combo", "suspicious_flag",
      "started_at", "ended_at", "created_at"
    ]);
  }
  return sheet;
}

function getTapRareLogsSheet_() {
  var ss    = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName("rare_logs");
  if (!sheet) {
    sheet = ss.insertSheet("rare_logs");
    sheet.appendRow(["id", "user_id", "reward", "type", "session_id", "created_at"]);
  }
  return sheet;
}

// action: tap_batch_play
// params: userId, sessionId, tapCount, maxCombo, startedAt, endedAt
function tapBatchPlay_(params) {
  var userId    = String(params.userId    || "");
  var sessionId = String(params.sessionId || "");
  var tapCount  = Math.floor(Number(params.tapCount  || 0));
  var maxCombo  = Math.floor(Number(params.maxCombo  || 0));
  var startedAt = String(params.startedAt || "");
  var endedAt   = String(params.endedAt   || "");

  if (!userId)       return json_({ ok: false, error: "userId_required" });
  if (tapCount <= 0) return json_({ ok: false, error: "invalid_tap_count" });

  var MAX_TAPS_PER_DAY = 500;
  var MAX_BATCH        = 50;

  var suspicious = tapCount > MAX_BATCH;
  if (suspicious) tapCount = MAX_BATCH;
  var requestedTapCount = tapCount;

  var sheet = getTapGameSheet_();
  ensureTapGameCols_(sheet);

  var nowJst   = new Date(Date.now() + 9 * 60 * 60 * 1000);
  var nowStr   = nowJst.toISOString();
  var todayStr = nowStr.slice(0, 10);

  var found = getTapGameRow_(sheet, userId);
  var rowNum, idx, row;
  if (!found) {
    sheet.appendRow([userId, 0, 0, 0, 0, 0, 0, todayStr, nowStr, false]);
    var data    = sheet.getDataRange().getValues();
    var headers = data[0];
    idx = {};
    headers.forEach(function(h, i) { idx[h] = i; });
    rowNum = sheet.getLastRow();
    row    = data[rowNum - 1];
  } else {
    rowNum = found.rowNum;
    idx    = found.idx;
    row    = found.row;
    resetTapIfNeeded_(sheet, rowNum, idx, row);
    row = sheet.getRange(rowNum, 1, 1, Object.keys(idx).length).getValues()[0];
  }

  if (suspicious) {
    sheet.getRange(rowNum, idx["suspicious_flag"] + 1).setValue(true);
  }

  var todayTaps = Number(row[idx["today_taps"]] || 0);
  var totalTaps = Number(row[idx["total_taps"]] || 0);

  var remaining    = MAX_TAPS_PER_DAY - todayTaps;
  if (remaining <= 0) {
    return json_({ ok: false, error: "daily_limit_reached", taps_remaining: 0 });
  }
  var processCount = Math.min(tapCount, remaining);

  var appliesSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("applies");
  var appliesData  = appliesSheet.getDataRange().getValues();
  var aHeaders     = appliesData[0];
  var aIdx         = {};
  aHeaders.forEach(function(h, i) { aIdx[h] = i; });
  var userRow = null, userRowNum = -1;
  for (var i = 1; i < appliesData.length; i++) {
    if (String(appliesData[i][aIdx["login_id"]]) === userId) {
      userRow    = appliesData[i];
      userRowNum = i + 1;
      break;
    }
  }
  if (!userRow) return json_({ ok: false, error: "user_not_found" });

  var BP_PER_TAP = 2;
  var currentBp = Number(userRow[aIdx["bp_balance"]] || 0);
  var affordable = Math.min(processCount, Math.floor(currentBp / BP_PER_TAP));
  if (affordable <= 0) return json_({ ok: false, error: "insufficient_bp", bp: currentBp });
  processCount = affordable;

  var bpCost = processCount * BP_PER_TAP;
  var afterBp = Math.round((currentBp - bpCost) * 100) / 100;

  var REWARD_TABLE = [
    { type: "BP", amount: 0.1,   prob: 0.45     },
    { type: "BP", amount: 0.2,   prob: 0.25     },
    { type: "BP", amount: 0.5,   prob: 0.08     },
    { type: "EP", amount: 1,     prob: 0.12     },
    { type: "EP", amount: 3,     prob: 0.04     },
    { type: "EP", amount: 10,    prob: 0.012    },
    { type: "EP", amount: 100,   prob: 0.0007   },
    { type: "EP", amount: 10000, prob: 0.000001 }
  ];

  var totalBpReward = 0;
  var totalEpReward = 0;
  var rareRewards   = [];
  var rareCount     = 0;

  for (var t = 0; t < processCount; t++) {
    var rand = Math.random(), cumulative = 0;
    var rType = "BP", rAmount = 0.1;
    for (var j = 0; j < REWARD_TABLE.length; j++) {
      cumulative += REWARD_TABLE[j].prob;
      if (rand < cumulative) { rType = REWARD_TABLE[j].type; rAmount = REWARD_TABLE[j].amount; break; }
    }
    if (rType === "BP") {
      totalBpReward = Math.round((totalBpReward + rAmount) * 100) / 100;
    } else {
      totalEpReward = Math.round((totalEpReward + rAmount) * 100) / 100;
      if (rAmount >= 50) { rareRewards.push({ type: "EP", amount: rAmount }); rareCount++; }
    }
  }

  afterBp = Math.round((afterBp + totalBpReward) * 100) / 100;
  var currentEp = Number(userRow[aIdx["ep_balance"]] || 0);
  var afterEp   = Math.round((currentEp + totalEpReward) * 100) / 100;
  appliesSheet.getRange(userRowNum, aIdx["bp_balance"] + 1).setValue(afterBp);
  if (totalEpReward > 0) {
    appliesSheet.getRange(userRowNum, aIdx["ep_balance"] + 1).setValue(afterEp);
  }

  var newTodayTaps     = todayTaps + processCount;
  var newTotalTaps     = totalTaps + processCount;
  var todayBp          = Number(row[idx["today_bp_earned"]] || 0);
  var todayEp          = Number(row[idx["today_ep_earned"]] || 0);
  var newTodayBp       = Math.round((todayBp + totalBpReward) * 100) / 100;
  var newTodayEp       = Math.round((todayEp + totalEpReward) * 100) / 100;
  var newMaxCombo      = Math.max(Number(row[idx["max_combo"]]       || 0), maxCombo);
  var newTodayMaxCombo = Math.max(Number(row[idx["today_max_combo"]] || 0), maxCombo);

  sheet.getRange(rowNum, idx["total_taps"]       + 1).setValue(newTotalTaps);
  sheet.getRange(rowNum, idx["today_taps"]       + 1).setValue(newTodayTaps);
  sheet.getRange(rowNum, idx["today_bp_earned"]  + 1).setValue(newTodayBp);
  sheet.getRange(rowNum, idx["today_ep_earned"]  + 1).setValue(newTodayEp);
  sheet.getRange(rowNum, idx["max_combo"]        + 1).setValue(newMaxCombo);
  sheet.getRange(rowNum, idx["today_max_combo"]  + 1).setValue(newTodayMaxCombo);
  sheet.getRange(rowNum, idx["last_tap_at"]      + 1).setValue(nowStr);

  var batchSheet = getTapBatchLogsSheet_();
  batchSheet.appendRow([
    sessionId || Utilities.getUuid(), userId,
    requestedTapCount, processCount,
    bpCost, totalBpReward, totalEpReward,
    rareCount, maxCombo, suspicious,
    startedAt || nowStr, endedAt || nowStr, nowStr
  ]);

  if (rareRewards.length > 0) {
    var rareSheet   = getTapRareLogsSheet_();
    var tickerSheet = getOrCreateTickerSheet_();
    var masked      = userId.length > 2 ? userId.slice(0, 2) + "***" : userId + "***";
    rareRewards.forEach(function(r) {
      rareSheet.appendRow([Utilities.getUuid(), userId, r.amount, "EP", sessionId || "", nowStr]);
      tickerSheet.appendRow([Utilities.getUuid(), masked, r.amount, "EP", nowStr]);
    });
  }

  return json_({
    ok:                true,
    processedTapCount: processCount,
    bpCost:            bpCost,
    bpReward:          totalBpReward,
    epReward:          totalEpReward,
    rareRewards:       rareRewards,
    todayTaps:         newTodayTaps,
    tapsRemaining:     MAX_TAPS_PER_DAY - newTodayTaps,
    bpBalance:         afterBp,
    epBalance:         afterEp,
    today_bp:          newTodayBp,
    today_ep:          newTodayEp
  });
}

// ============================================================
// RUMBLE LEAGUE（rumble_entry / rumble_week / equipment シート）
// 追加日: 2026-03 / 既存コードへの変更なし・追記のみ
// ============================================================

// Google Sheets がセル値を Date オブジェクトに自動変換した場合でも
// "YYYY-MM-DD" 文字列として返すヘルパー
function rumbleDateStr_(val) {
  if (val instanceof Date) {
    return Utilities.formatDate(val, "Asia/Tokyo", "yyyy-MM-dd");
  }
  return String(val);
}

function getRumbleEntrySheet_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName("rumble_entry");
  if (!sheet) sheet = ss.insertSheet("rumble_entry");
  return sheet;
}

function getRumbleWeekSheet_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName("rumble_week");
  if (!sheet) sheet = ss.insertSheet("rumble_week");
  return sheet;
}

function getEquipmentSheet_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName("equipment");
  if (!sheet) sheet = ss.insertSheet("equipment");
  return sheet;
}

function ensureRumbleEntryCols_(sheet) {
  if (sheet.getLastRow() > 0) return;
  sheet.appendRow(["id","user_id","date","score","rp","created_at"]);
}

function ensureRumbleWeekCols_(sheet) {
  if (sheet.getLastRow() > 0) return;
  sheet.appendRow(["user_id","week_id","total_rp","updated_at"]);
}

function ensureEquipmentCols_(sheet) {
  if (sheet.getLastRow() > 0) return;
  sheet.appendRow(["id","user_id","slot","rarity","name","base_bonus","bonus","quality","enhance_level","enhance_bonus","luck","stability","equipped","locked","created_at"]);
}

function getWeekId_() {
  var now = new Date(Date.now() + 9 * 60 * 60 * 1000);
  var year = now.getUTCFullYear();
  var startOfYear = new Date(Date.UTC(year, 0, 1));
  var weekNum = Math.ceil(((now - startOfYear) / 86400000 + startOfYear.getUTCDay() + 1) / 7);
  return year + "-W" + String(weekNum).padStart(2, "0");
}

function getTodayJst_() {
  var now = new Date(Date.now() + 9 * 60 * 60 * 1000);
  return now.toISOString().slice(0, 10);
}

// ============================================================
// RUMBLE DAILY LOTTERY — helpers
// ============================================================

function getRumbleDailyResultSheet_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName("rumble_daily_result");
  if (!sheet) sheet = ss.insertSheet("rumble_daily_result");
  return sheet;
}

function getRumbleBattleLogSheet_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName("rumble_battle_log");
  if (!sheet) {
    sheet = ss.insertSheet("rumble_battle_log");
    sheet.appendRow(["date", "players_json", "events_json", "total", "ranking_json", "created_at"]);
  }
  return sheet;
}

function getBattleLogCache_(dateStr) {
  var sheet = getRumbleBattleLogSheet_();
  var data = sheet.getDataRange().getValues();
  if (data.length < 2) return null;
  var headers = data[0];
  var idx = {};
  headers.forEach(function(h, i) { idx[h] = i; });
  for (var i = 1; i < data.length; i++) {
    if (rumbleDateStr_(data[i][idx["date"]]) === dateStr) {
      try {
        return {
          date:    dateStr,
          players: JSON.parse(String(data[i][idx["players_json"]] || "[]")),
          events:  JSON.parse(String(data[i][idx["events_json"]]  || "[]")),
          total:   Number(data[i][idx["total"]] || 0),
          ranking: JSON.parse(String(data[i][idx["ranking_json"]] || "[]")),
        };
      } catch(e) {
        return null;
      }
    }
  }
  return null;
}

function getLatestBattleLogCache_() {
  var sheet = getRumbleBattleLogSheet_();
  var data = sheet.getDataRange().getValues();
  if (data.length < 2) return null;
  var headers = data[0];
  var idx = {};
  headers.forEach(function(h, i) { idx[h] = i; });
  var latestDate = '';
  var latestRow = null;
  for (var i = 1; i < data.length; i++) {
    var d = rumbleDateStr_(data[i][idx["date"]]);
    if (d > latestDate) { latestDate = d; latestRow = data[i]; }
  }
  if (!latestRow) return null;
  try {
    return {
      date:    latestDate,
      players: JSON.parse(String(latestRow[idx["players_json"]] || "[]")),
      events:  JSON.parse(String(latestRow[idx["events_json"]]  || "[]")),
      total:   Number(latestRow[idx["total"]] || 0),
      ranking: JSON.parse(String(latestRow[idx["ranking_json"]] || "[]")),
    };
  } catch(e) { return null; }
}

function saveBattleLog_(dateStr, players, events, total, ranking) {
  var sheet = getRumbleBattleLogSheet_();
  var data = sheet.getDataRange().getValues();
  var nowJst      = new Date(Date.now() + 9 * 60 * 60 * 1000).toISOString();
  var playersJson = JSON.stringify(players);
  var eventsJson  = JSON.stringify(events);
  var rankingJson = JSON.stringify(ranking);
  if (data.length < 1) {
    sheet.appendRow([dateStr, playersJson, eventsJson, total, rankingJson, nowJst]);
    SpreadsheetApp.flush();
    return;
  }
  var headers = data[0];
  var idx = {};
  headers.forEach(function(h, i) { idx[h] = i; });
  for (var i = 1; i < data.length; i++) {
    if (rumbleDateStr_(data[i][idx["date"]]) === dateStr) {
      var rowNum = i + 1;
      sheet.getRange(rowNum, idx["players_json"] + 1).setValue(playersJson);
      sheet.getRange(rowNum, idx["events_json"]  + 1).setValue(eventsJson);
      sheet.getRange(rowNum, idx["total"]        + 1).setValue(total);
      sheet.getRange(rowNum, idx["ranking_json"] + 1).setValue(rankingJson);
      sheet.getRange(rowNum, idx["created_at"]   + 1).setValue(nowJst);
      SpreadsheetApp.flush();
      return;
    }
  }
  sheet.appendRow([dateStr, playersJson, eventsJson, total, rankingJson, nowJst]);
  SpreadsheetApp.flush();
}

function ensureRumbleDailyResultCols_(sheet) {
  if (sheet.getLastRow() > 0) return;
  sheet.appendRow([
    "date","seed","rank","user_id","display_name",
    "rp","weight","bp_amount","distributed","participant_count","created_at"
  ]);
}

/**
 * sha256(dateStr + RUMBLE_SALT) → hex string
 * RUMBLE_SALT is stored in ScriptProperties. Falls back to "rumble_default_salt".
 */
function computeSeed_(dateStr) {
  var props = PropertiesService.getScriptProperties();
  var salt  = props.getProperty("RUMBLE_SALT") || "rumble_default_salt";
  var input = dateStr + salt;
  var bytes = Utilities.computeDigest(
    Utilities.DigestAlgorithm.SHA_256, input, Utilities.Charset.UTF_8
  );
  return bytes.map(function(b) {
    return ("0" + (b & 0xff).toString(16)).slice(-2);
  }).join("");
}

/**
 * Convert first 8 hex chars of sha256 to uint32. Never returns 0.
 */
function seedToInt_(hexStr) {
  var n = parseInt(hexStr.slice(0, 8), 16) >>> 0;
  return n || 1;
}

/**
 * Returns a seeded xorshift RNG function for the given date string.
 * Same dateStr → same sequence every time.
 */
function rumbleDailyRng_(dateStr) {
  var x = seedToInt_(computeSeed_(dateStr));
  return function() {
    x = (x ^ (x << 13)) >>> 0;
    x = (x ^ (x >> 17)) >>> 0;
    x = (x ^ (x << 5))  >>> 0;
    return (x >>> 0) / 4294967296;
  };
}

/**
 * Weighted selection from pool array (each element has a .weight property).
 * Calls rng() exactly once. Returns the selected index.
 */
function weightedSelect_(pool, rng) {
  var total = 0;
  for (var i = 0; i < pool.length; i++) total += pool[i].weight;
  var r = rng() * total;
  var cum = 0;
  for (var i = 0; i < pool.length; i++) {
    cum += pool[i].weight;
    if (r < cum) return i;
  }
  return pool.length - 1;
}

function getUserEquipmentBonus_(userId) {
  var sheet = getEquipmentSheet_();
  ensureEquipmentCols_(sheet);
  var data = sheet.getDataRange().getValues();
  if (data.length <= 1) return 0;
  var headers = data[0];
  var idx = {};
  headers.forEach(function(h, i) { idx[h] = i; });
  var total = 0;
  for (var i = 1; i < data.length; i++) {
    if (String(data[i][idx["user_id"]]) === userId &&
        String(data[i][idx["equipped"]]) === "true") {
      total += Number(data[i][idx["bonus"]] || 0);
    }
  }
  return Math.min(total, 50); // 上限50
}

// action: rumble_entry
function rumbleEntry_(params) {
  var userId = String(params.userId || "");
  if (!userId) return json_({ ok: false, error: "userId_required" });

  // 並行実行による二重エントリーを防ぐためスクリプトロックを取得
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(15000); // 最大15秒待機
  } catch (e) {
    return json_({ ok: false, error: "lock_timeout" });
  }

  try {
    var today   = getTodayJst_();
    var weekId  = getWeekId_();
    var nowJst  = new Date(Date.now() + 9 * 60 * 60 * 1000).toISOString();

    // 本日参加済みチェック（ロック取得後に最新データを読み直す）
    var entrySheet = getRumbleEntrySheet_();
    ensureRumbleEntryCols_(entrySheet);
    var entryData = entrySheet.getDataRange().getValues();
    var eHeaders  = entryData[0];
    var eIdx      = {};
    eHeaders.forEach(function(h, i) { eIdx[h] = i; });
    for (var i = 1; i < entryData.length; i++) {
      if (String(entryData[i][eIdx["user_id"]]) === userId &&
          rumbleDateStr_(entryData[i][eIdx["date"]]) === today) {
        return json_({ ok: false, error: "already_entered_today" });
      }
    }

    // BP残高確認（100BP消費）
    var appliesSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("applies");
    var appliesData  = appliesSheet.getDataRange().getValues();
    var aHeaders     = appliesData[0];
    var aIdx         = {};
    aHeaders.forEach(function(h, i) { aIdx[h] = i; });

    var userRow    = null;
    var userRowNum = -1;
    for (var j = 1; j < appliesData.length; j++) {
      if (String(appliesData[j][aIdx["login_id"]]) === userId) {
        userRow    = appliesData[j];
        userRowNum = j + 1;
        break;
      }
    }
    if (!userRow) return json_({ ok: false, error: "user_not_found" });

    var currentBp = Number(userRow[aIdx["bp_balance"]] || 0);
    if (currentBp < 100) return json_({ ok: false, error: "insufficient_bp", bp: currentBp });

    // BP -100消費
    var newBp = Math.round((currentBp - 100) * 100) / 100;
    appliesSheet.getRange(userRowNum, aIdx["bp_balance"] + 1).setValue(newBp);

    // スコア計算
    var userLevel    = Number(userRow[aIdx["level"]] || 1);
    var levelBonus   = userLevel * 2;
    var equipBonus   = getUserEquipmentBonus_(userId);
    var randomFactor = Math.floor(Math.random() * 51); // 0〜50
    var score        = 100 + levelBonus + equipBonus + randomFactor;
    var rp           = score;

    // rumble_entryに記録
    entrySheet.appendRow([
      Utilities.getUuid(), userId, today, score, rp, nowJst
    ]);

    // シートへの書き込みを即座に確定させる（後続の読み込みで古いキャッシュを返さないよう）
    SpreadsheetApp.flush();

    // rumble_week更新
    var weekSheet = getRumbleWeekSheet_();
    ensureRumbleWeekCols_(weekSheet);
    var weekData    = weekSheet.getDataRange().getValues();
    var wHeaders    = weekData[0];
    var wIdx        = {};
    wHeaders.forEach(function(h, i) { wIdx[h] = i; });
    var weekRowNum  = -1;
    var currentRp   = 0;
    for (var k = 1; k < weekData.length; k++) {
      if (String(weekData[k][wIdx["user_id"]]) === userId &&
          String(weekData[k][wIdx["week_id"]]) === weekId) {
        weekRowNum = k + 1;
        currentRp  = Number(weekData[k][wIdx["total_rp"]] || 0);
        break;
      }
    }
    if (weekRowNum === -1) {
      weekSheet.appendRow([userId, weekId, rp, nowJst]);
    } else {
      weekSheet.getRange(weekRowNum, wIdx["total_rp"] + 1).setValue(currentRp + rp);
      weekSheet.getRange(weekRowNum, wIdx["updated_at"] + 1).setValue(nowJst);
    }

    return json_({
      ok:    true,
      score: score,
      rp:    rp,
      bp:    newBp,
      week_id: weekId,
    });
  } finally {
    lock.releaseLock();
  }
}

// action: rumble_ranking
function rumbleRanking_(params) {
  var weekId    = params.weekId || getWeekId_();
  var weekSheet = getRumbleWeekSheet_();
  ensureRumbleWeekCols_(weekSheet);
  var data = weekSheet.getDataRange().getValues();
  if (data.length <= 1) return json_({ ok: true, ranking: [], week_id: weekId });

  var headers = data[0];
  var idx     = {};
  headers.forEach(function(h, i) { idx[h] = i; });

  // applies から display_name マップを構築
  var appliesSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("applies");
  var appliesData  = appliesSheet.getDataRange().getValues();
  var aHeaders     = appliesData[0];
  ensureCols_(appliesSheet, aHeaders, ["rumble_display_name"]);
  var aIdx = {};
  aHeaders.forEach(function(h, i) { aIdx[h] = i; });
  var displayNameMap = {};
  for (var i = 1; i < appliesData.length; i++) {
    var uid = String(appliesData[i][aIdx["login_id"]] || "");
    if (uid) displayNameMap[uid] = String(appliesData[i][aIdx["rumble_display_name"]] || "");
  }

  var rows = data.slice(1)
    .filter(function(row) { return String(row[idx["week_id"]]) === weekId; })
    .map(function(row) {
      var uid = String(row[idx["user_id"]]);
      return {
        user_id:      uid,
        total_rp:     Number(row[idx["total_rp"]] || 0),
        display_name: displayNameMap[uid] || "",
      };
    });

  rows.sort(function(a, b) { return b.total_rp - a.total_rp; });
  return json_({ ok: true, ranking: rows.slice(0, 100), week_id: weekId });
}

// action: rumble_status
function rumbleStatus_(params) {
  var userId = String(params.userId || "");
  var today  = getTodayJst_();
  var weekId = getWeekId_();

  // 本日参加済みか
  var entrySheet = getRumbleEntrySheet_();
  ensureRumbleEntryCols_(entrySheet);
  var entryData = entrySheet.getDataRange().getValues();
  var eHeaders  = entryData[0];
  var eIdx      = {};
  eHeaders.forEach(function(h, i) { eIdx[h] = i; });
  var todayEntry = null;
  for (var i = 1; i < entryData.length; i++) {
    if (String(entryData[i][eIdx["user_id"]]) === userId &&
        rumbleDateStr_(entryData[i][eIdx["date"]]) === today) {
      todayEntry = {
        score: Number(entryData[i][eIdx["score"]]),
        rp:    Number(entryData[i][eIdx["rp"]]),
      };
      break;
    }
  }

  // 週間累計RP
  var weekSheet = getRumbleWeekSheet_();
  ensureRumbleWeekCols_(weekSheet);
  var weekData = weekSheet.getDataRange().getValues();
  var wHeaders = weekData[0];
  var wIdx     = {};
  wHeaders.forEach(function(h, i) { wIdx[h] = i; });
  var weekRp = 0;
  var weekParticipantCount = 0;
  for (var j = 1; j < weekData.length; j++) {
    if (String(weekData[j][wIdx["week_id"]]) === weekId) {
      weekParticipantCount++;
      if (String(weekData[j][wIdx["user_id"]]) === userId) {
        weekRp = Number(weekData[j][wIdx["total_rp"]] || 0);
      }
    }
  }

  // BP残高
  var appSheet  = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("applies");
  var appData   = appSheet.getDataRange().getValues();
  var aHeaders  = appData[0];
  var aIdx      = {};
  aHeaders.forEach(function(h, i) { aIdx[h] = i; });
  var bpBalance   = 0;
  var displayName = "";
  for (var k = 1; k < appData.length; k++) {
    if (String(appData[k][aIdx["login_id"]]) === userId) {
      bpBalance   = Number(appData[k][aIdx["bp_balance"]] || 0);
      displayName = String(appData[k][aIdx["rumble_display_name"]] || "");
      break;
    }
  }

  return json_({
    ok:                    true,
    entered_today:         todayEntry !== null,
    today_score:           todayEntry ? todayEntry.score : null,
    today_rp:              todayEntry ? todayEntry.rp    : null,
    week_rp:               weekRp,
    week_id:               weekId,
    bp_balance:            bpBalance,
    display_name:          displayName,
    week_participant_count: weekParticipantCount,
  });
}

// action: rumble_gacha
function rumbleGacha_(params) {
  var userId = String(params.userId || "");
  if (!userId) return json_({ ok: false, error: "userId_required" });

  var GACHA_COST = 100;
  var RARITY_TABLE = [
    { rarity: "common",    prob: 0.80    },
    { rarity: "rare",      prob: 0.15    },
    { rarity: "epic",      prob: 0.04    },
    { rarity: "legendary", prob: 0.009995},
    { rarity: "mythic",    prob: 0.000005},
  ];
  var BONUS_MAP = {
    common:    { min: 3,  max: 8  },
    rare:      { min: 8,  max: 15 },
    epic:      { min: 15, max: 28 },
    legendary: { min: 28, max: 42 },
    mythic:    { min: 42, max: 55 },
  };
  var SLOTS     = ["head", "body", "hand", "leg"];
  var NAMES     = {
    common:    ["鉄の兜","布の鎧","革の手袋","擦り切れたブーツ"],
    rare:      ["鋼の兜","鎖帷子","鉄の籠手","疾風のブーツ"],
    epic:      ["竜鱗の兜","ミスリル鎧","影の手袋","嵐のブーツ"],
    legendary: ["王者の冠","盾神の鎧","雷霆の籠手","虚空のブーツ"],
    mythic:    ["宇宙の冠","無限の鎧","銀河の手袋","永劫のブーツ"],
  };

  // BP残高確認
  var appliesSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("applies");
  var appliesData  = appliesSheet.getDataRange().getValues();
  var aHeaders     = appliesData[0];
  var aIdx         = {};
  aHeaders.forEach(function(h, i) { aIdx[h] = i; });
  var userRow    = null;
  var userRowNum = -1;
  for (var i = 1; i < appliesData.length; i++) {
    if (String(appliesData[i][aIdx["login_id"]]) === userId) {
      userRow    = appliesData[i];
      userRowNum = i + 1;
      break;
    }
  }
  if (!userRow) return json_({ ok: false, error: "user_not_found" });

  var currentBp = Number(userRow[aIdx["bp_balance"]] || 0);
  if (currentBp < GACHA_COST) return json_({ ok: false, error: "insufficient_bp", bp: currentBp });

  // BP消費
  var newBp = Math.round((currentBp - GACHA_COST) * 100) / 100;
  appliesSheet.getRange(userRowNum, aIdx["bp_balance"] + 1).setValue(newBp);

  // 抽選
  var rand       = Math.random();
  var cumulative = 0;
  var rarity     = "common";
  for (var j = 0; j < RARITY_TABLE.length; j++) {
    cumulative += RARITY_TABLE[j].prob;
    if (rand < cumulative) { rarity = RARITY_TABLE[j].rarity; break; }
  }

  var slot  = SLOTS[Math.floor(Math.random() * SLOTS.length)];
  var names = NAMES[rarity];
  var name  = names[Math.floor(Math.random() * names.length)];
  var bonusRange = BONUS_MAP[rarity];
  var baseBonus  = bonusRange.min + Math.random() * (bonusRange.max - bonusRange.min);
  var quality    = 0.8 + Math.random() * 0.4; // 80%〜120%
  var bonus      = Math.round(baseBonus * quality * 10) / 10;
  var nowJst = new Date(Date.now() + 9 * 60 * 60 * 1000).toISOString();
  var eqId   = Utilities.getUuid();

  // サブステ生成
  var SUB_RANGE = {
    common:    { min: 0.1, max: 0.5 },
    rare:      { min: 0.3, max: 1.0 },
    epic:      { min: 0.8, max: 2.0 },
    legendary: { min: 1.5, max: 3.5 },
    mythic:    { min: 3.0, max: 6.0 },
  };
  var SUB_COUNT = {
    common:    Math.random() < 0.3 ? 1 : 0,
    rare:      1,
    epic:      2,
    legendary: Math.random() < 0.2 ? 3 : 2,
    mythic:    3,
  };
  var subRange  = SUB_RANGE[rarity];
  var subCount  = SUB_COUNT[rarity];
  var luckVal   = 0;
  var stabilityVal = 0;
  var subTypes  = ["luck","stability"];
  for (var s = 0; s < subCount; s++) {
    var subType = subTypes[s % 2];
    var subVal  = Math.round((subRange.min + Math.random() * (subRange.max - subRange.min)) * 100) / 100;
    if (subType === "luck")      luckVal      = Math.round((luckVal + subVal) * 100) / 100;
    else                          stabilityVal = Math.round((stabilityVal + subVal) * 100) / 100;
  }

  // equipment保存（新カラム対応）
  var eqSheet = getEquipmentSheet_();
  ensureEquipmentCols_(eqSheet);
  ensureEquipmentNewCols_(eqSheet);
  eqSheet.appendRow([
    eqId, userId, slot, rarity, name,
    bonus, bonus, quality,   // base_bonus / bonus（強化前は同値）/ quality
    0, 0,                    // enhance_level / enhance_bonus
    luckVal, stabilityVal,   // luck / stability
    "false", "false", nowJst
  ]);
  SpreadsheetApp.flush();

  // 各スロット10個上限チェック：超えたら最古の非装備・非ロックアイテムを自動分解
  var SLOT_LIMIT = 10;
  var SHARD_BASE_GACHA = { common: 1, rare: 3, epic: 10, legendary: 40, mythic: 300 };
  var autoGainedShard = 0;
  var autoDiscarded   = [];

  var eqData2   = eqSheet.getDataRange().getValues();
  var eqHeaders = eqData2[0];
  var eqIdx2    = {};
  eqHeaders.forEach(function(h, i) { eqIdx2[h] = i; });

  // 対象スロットのアイテムを created_at 昇順で取得
  var slotItems = [];
  for (var si = 1; si < eqData2.length; si++) {
    if (String(eqData2[si][eqIdx2["user_id"]]) !== userId) continue;
    if (String(eqData2[si][eqIdx2["slot"]]) !== slot) continue;
    slotItems.push({
      rowNum:       si + 1,
      id:           String(eqData2[si][eqIdx2["id"]]),
      rarity:       String(eqData2[si][eqIdx2["rarity"]]),
      enhance_level: Number(eqData2[si][eqIdx2["enhance_level"]] || 0),
      quality:      Number(eqData2[si][eqIdx2["quality"]] || 100),
      equipped:     String(eqData2[si][eqIdx2["equipped"]]) === "true",
      locked:       String(eqData2[si][eqIdx2["locked"]]) === "true",
      created_at:   String(eqData2[si][eqIdx2["created_at"]] || ""),
    });
  }
  // created_at 昇順
  slotItems.sort(function(a, b) { return a.created_at < b.created_at ? -1 : 1; });

  // 超過分を古い順に自動分解（装備中・ロック中はスキップ）
  if (slotItems.length > SLOT_LIMIT) {
    var userData2 = getUserShards_(userId);
    var currentShards = userData2 ? userData2.shards : 0;
    var sheetForShards = userData2 ? userData2.sheet : null;
    var rowForShards   = userData2 ? userData2.rowNum : -1;
    var idxForShards   = userData2 ? userData2.idx : null;

    var toDelete = []; // rowNum を逆順削除用
    for (var di = 0; di < slotItems.length && slotItems.length - toDelete.length > SLOT_LIMIT; di++) {
      var item = slotItems[di];
      if (item.equipped || item.locked) continue;
      var base   = SHARD_BASE_GACHA[item.rarity] || 1;
      var bonus2 = item.enhance_level;
      if (item.quality >= 115) bonus2 += 8;
      else if (item.quality >= 110) bonus2 += 3;
      var gained = base + bonus2;
      currentShards += gained;
      autoGainedShard += gained;
      autoDiscarded.push({ id: item.id, rarity: item.rarity });
      toDelete.push(item.rowNum);
    }
    // 行削除（大きい行番号から削除してズレを防ぐ）
    toDelete.sort(function(a, b) { return b - a; });
    toDelete.forEach(function(r) { eqSheet.deleteRow(r); });
    if (sheetForShards && rowForShards > 0) {
      setUserShards_(sheetForShards, rowForShards, idxForShards, currentShards);
    }
  }

  return json_({
    ok:     true,
    item:   { id: eqId, slot: slot, rarity: rarity, name: name, bonus: bonus },
    bp:     newBp,
    auto_discarded:   autoDiscarded.length,
    auto_shard_gained: autoGainedShard,
  });
}

// action: rumble_equipment
function rumbleEquipment_(params) {
  var userId = String(params.userId || "");
  var sheet  = getEquipmentSheet_();
  ensureEquipmentCols_(sheet);
  var data    = sheet.getDataRange().getValues();
  var headers = data[0];
  var idx     = {};
  headers.forEach(function(h, i) { idx[h] = i; });

  var items = [];
  for (var i = 1; i < data.length; i++) {
    if (String(data[i][idx["user_id"]]) === userId) {
      items.push({
        id:       String(data[i][idx["id"]]),
        slot:     String(data[i][idx["slot"]]),
        rarity:   String(data[i][idx["rarity"]]),
        name:     String(data[i][idx["name"]]),
        bonus:    Number(data[i][idx["bonus"]] || 0),
        equipped: String(data[i][idx["equipped"]]) === "true",
      });
    }
  }
  return json_({ ok: true, items: items });
}

// action: rumble_equip
function rumbleEquip_(params) {
  var userId = String(params.userId || "");
  var itemId = String(params.itemId || "");
  if (!userId || !itemId) return json_({ ok: false, error: "params_required" });

  var sheet = getEquipmentSheet_();
  ensureEquipmentCols_(sheet);
  var data    = sheet.getDataRange().getValues();
  var headers = data[0];
  var idx     = {};
  headers.forEach(function(h, i) { idx[h] = i; });

  // 対象アイテムのスロットを取得
  var targetSlot = null;
  var targetRow  = -1;
  for (var i = 1; i < data.length; i++) {
    if (String(data[i][idx["id"]]) === itemId &&
        String(data[i][idx["user_id"]]) === userId) {
      targetSlot = String(data[i][idx["slot"]]);
      targetRow  = i + 1;
      break;
    }
  }
  if (!targetSlot) return json_({ ok: false, error: "item_not_found" });

  // 同スロットの装備を全て外す
  for (var j = 1; j < data.length; j++) {
    if (String(data[j][idx["user_id"]]) === userId &&
        String(data[j][idx["slot"]])    === targetSlot) {
      sheet.getRange(j + 1, idx["equipped"] + 1).setValue("false");
    }
  }
  // 対象を装備
  sheet.getRange(targetRow, idx["equipped"] + 1).setValue("true");
  return json_({ ok: true });
}

// action: rumble_reward_distribute（週次報酬配布）
function rumbleRewardDistribute_(params) {
  var weekId    = params.weekId || getWeekId_();

  // Idempotency check via ScriptProperties
  var propKey = "RUMBLE_WEEK_DISTRIBUTED_" + weekId;
  var props   = PropertiesService.getScriptProperties();
  if (props.getProperty(propKey) && !params.force) {
    Logger.log("[rumbleRewardDistribute_] Already distributed for " + weekId);
    return json_({ ok: true, distributed: 0, week_id: weekId, skipped: "already_done" });
  }

  var weekSheet = getRumbleWeekSheet_();
  ensureRumbleWeekCols_(weekSheet);
  var weekData = weekSheet.getDataRange().getValues();
  var wHeaders = weekData[0];
  var wIdx     = {};
  wHeaders.forEach(function(h, i) { wIdx[h] = i; });

  var rows = weekData.slice(1)
    .filter(function(row) { return String(row[wIdx["week_id"]]) === weekId; })
    .map(function(row) { return { user_id: String(row[wIdx["user_id"]]), total_rp: Number(row[wIdx["total_rp"]] || 0) }; });
  rows.sort(function(a, b) { return b.total_rp - a.total_rp; });

  var appliesSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("applies");
  var appliesData  = appliesSheet.getDataRange().getValues();
  var aHeaders     = appliesData[0];
  var aIdx         = {};
  aHeaders.forEach(function(h, i) { aIdx[h] = i; });

  // Build email map
  var emailMap = {};
  for (var e = 1; e < appliesData.length; e++) {
    emailMap[String(appliesData[e][aIdx["login_id"]])] = String(appliesData[e][aIdx["email"]] || "");
  }

  // 参加人数に応じた週次報酬テーブル（合計〜700 EP）
  var n = rows.length;
  var WEEKLY_REWARDS;
  if (n <= 2) {
    WEEKLY_REWARDS = [
      { rank_min: 1, rank_max: 1, ep: 400 },
      { rank_min: 2, rank_max: 2, ep: 300 },
    ];
  } else if (n <= 4) {
    WEEKLY_REWARDS = [
      { rank_min: 1, rank_max: 1, ep: 350 },
      { rank_min: 2, rank_max: 2, ep: 230 },
      { rank_min: 3, rank_max: 3, ep: 120 },
    ];
  } else if (n <= 9) {
    WEEKLY_REWARDS = [
      { rank_min: 1, rank_max: 1, ep: 300 },
      { rank_min: 2, rank_max: 2, ep: 200 },
      { rank_min: 3, rank_max: 3, ep: 120 },
      { rank_min: 4, rank_max: 5, ep: 40  },
    ];
  } else {
    WEEKLY_REWARDS = [
      { rank_min: 1,  rank_max: 1,  ep: 280 },
      { rank_min: 2,  rank_max: 2,  ep: 190 },
      { rank_min: 3,  rank_max: 3,  ep: 120 },
      { rank_min: 4,  rank_max: 5,  ep: 45  },
      { rank_min: 6,  rank_max: 10, ep: 4   },
    ];
  }

  var distributed = 0;
  rows.forEach(function(entry, i) {
    var rank = i + 1;
    var ep   = 0;
    for (var j = 0; j < WEEKLY_REWARDS.length; j++) {
      if (rank >= WEEKLY_REWARDS[j].rank_min && rank <= WEEKLY_REWARDS[j].rank_max) {
        ep = WEEKLY_REWARDS[j].ep;
        break;
      }
    }
    if (ep <= 0) return;

    for (var k = 1; k < appliesData.length; k++) {
      if (String(appliesData[k][aIdx["login_id"]]) === entry.user_id) {
        var currentEp = Number(appliesData[k][aIdx["ep_balance"]] || 0);
        appliesSheet.getRange(k + 1, aIdx["ep_balance"] + 1).setValue(currentEp + ep);
        distributed++;

        // Record to wallet_ledger
        appendWalletLedger_({
          kind:     "rumble_weekly_ep",
          login_id: entry.user_id,
          email:    emailMap[entry.user_id] || "",
          amount:   ep,
          memo:     weekId + " 週次EP報酬 " + rank + "位",
        });

        break;
      }
    }
  });

  // Mark week as distributed
  props.setProperty(propKey, new Date().toISOString());

  return json_({ ok: true, distributed: distributed, week_id: weekId });
}

/** Called by GAS time trigger (金曜 23:00〜24:00 JST) */
function rumbleWeeklyRewardTrigger_() {
  var weekId = getWeekId_();
  Logger.log("[rumbleWeeklyRewardTrigger_] Starting for " + weekId);
  var result = rumbleRewardDistribute_({ weekId: weekId });
  Logger.log("[rumbleWeeklyRewardTrigger_] " + JSON.stringify(result));
}

// ============================================================
// action: rumble_daily_lottery（日次BP抽選・GASタイムトリガーから呼ばれる）
// ============================================================

var RUMBLE_DAILY_BP_REWARDS_ = [1000, 700, 400, 250, 200];

function rumbleDailyLottery_(params) {
  var dateStr  = String(params.date || getTodayJst_());
  // created_at in rumble_entry is stored as fake-JST ISO (Date.now()+9h).
  // 18:50 JST stored in that format = "YYYY-MM-DDT18:50:00.000Z"
  // deadlineOverride を渡すと任意の締め切りで実行可能（rumble_run_now から使用）
  var deadline = params.deadlineOverride || (dateStr + "T18:50:00.000Z");

  // 1. Get participants filtered by deadline
  var entrySheet = getRumbleEntrySheet_();
  ensureRumbleEntryCols_(entrySheet);
  var entryData = entrySheet.getDataRange().getValues();
  var eHeaders  = entryData[0];
  var eIdx      = {};
  eHeaders.forEach(function(h, i) { eIdx[h] = i; });

  var participants = [];
  for (var i = 1; i < entryData.length; i++) {
    var row = entryData[i];
    if (rumbleDateStr_(row[eIdx["date"]]) !== dateStr) continue;
    var createdAt = String(row[eIdx["created_at"]] || "");
    if (createdAt && createdAt > deadline) continue;
    participants.push({
      user_id: String(row[eIdx["user_id"]]),
      rp:      Number(row[eIdx["rp"]] || 0),
    });
  }

  if (participants.length === 0) {
    Logger.log("[rumbleDailyLottery_] No participants for " + dateStr);
    return json_({ ok: true, distributed: 0, date: dateStr, skipped: "no_participants" });
  }

  // 2. Idempotency: if all winnerCount ranks are distributed=true, skip
  var winnerCount  = Math.min(5, participants.length);
  var resultSheet  = getRumbleDailyResultSheet_();
  ensureRumbleDailyResultCols_(resultSheet);
  var resultData   = resultSheet.getDataRange().getValues();
  var rHeaders     = resultData[0];
  var rIdx         = {};
  rHeaders.forEach(function(h, i) { rIdx[h] = i; });

  var existingRows = [];
  for (var i = 1; i < resultData.length; i++) {
    if (String(resultData[i][rIdx["date"]]) !== dateStr) continue;
    existingRows.push({
      rowNum:      i + 1,
      rank:        Number(resultData[i][rIdx["rank"]]),
      user_id:     String(resultData[i][rIdx["user_id"]]),
      distributed: String(resultData[i][rIdx["distributed"]]) === "true",
    });
  }

  var doneCount = existingRows.filter(function(r) {
    return r.rank >= 1 && r.rank <= winnerCount && r.distributed;
  }).length;
  if (doneCount === winnerCount) {
    Logger.log("[rumbleDailyLottery_] Already complete for " + dateStr);
    return json_({ ok: true, distributed: 0, date: dateStr, skipped: "already_done" });
  }

  // 3. Seed + RNG (deterministic: same dateStr → same sequence)
  var seedHex = computeSeed_(dateStr);
  var rng     = rumbleDailyRng_(dateStr);

  // 4. Build weighted pool
  var pool = participants.map(function(p) {
    return {
      user_id: p.user_id,
      rp:      p.rp,
      weight:  Math.floor(Math.sqrt(p.rp) * 1000),
    };
  });

  // 5. Load applies data (BP grant + display names)
  var appliesSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("applies");
  var appliesData  = appliesSheet.getDataRange().getValues();
  var aHeaders     = appliesData[0];
  var aIdx         = {};
  aHeaders.forEach(function(h, i) { aIdx[h] = i; });

  var displayNameMap = {};
  var emailMap       = {};
  for (var j = 1; j < appliesData.length; j++) {
    var uid = String(appliesData[j][aIdx["login_id"]]);
    displayNameMap[uid] = String(appliesData[j][aIdx["rumble_display_name"]] || uid);
    emailMap[uid]       = String(appliesData[j][aIdx["email"]] || "");
  }

  var nowJst      = new Date(Date.now() + 9 * 60 * 60 * 1000).toISOString();
  var distributed = 0;

  // 6. Lottery: rank 1 to winnerCount, one winner at a time
  for (var rank = 1; rank <= winnerCount; rank++) {
    // Always run RNG in sequence (deterministic replay for recovery)
    var poolIdx = weightedSelect_(pool, rng); // consumes exactly 1 rng() call
    var winner  = pool[poolIdx];
    pool.splice(poolIdx, 1); // remove from pool for next round

    // If this rank is already distributed=true, skip entirely
    var alreadyDone = existingRows.some(function(r) {
      return r.rank === rank && r.distributed;
    });
    if (alreadyDone) {
      Logger.log("[rumbleDailyLottery_] rank=" + rank + " already distributed, skipping");
      continue;
    }

    var bpAmount    = RUMBLE_DAILY_BP_REWARDS_[rank - 1];
    var displayName = displayNameMap[winner.user_id] || winner.user_id;
    var email       = emailMap[winner.user_id] || "";

    // Check if row already exists for this rank (distributed=false = crash recovery)
    // Re-read sheet to get accurate row numbers (appendRow in prior ranks shifts rows)
    var rDataCur = resultSheet.getDataRange().getValues();
    var rHCur    = rDataCur[0];
    var rICur    = {};
    rHCur.forEach(function(h, i) { rICur[h] = i; });
    var existingRowNum = -1;
    for (var ri2 = 1; ri2 < rDataCur.length; ri2++) {
      if (String(rDataCur[ri2][rICur["date"]]) === dateStr &&
          Number(rDataCur[ri2][rICur["rank"]]) === rank) {
        existingRowNum = ri2 + 1;
        break;
      }
    }

    var rowAlreadyWritten = existingRowNum !== -1;

    if (!rowAlreadyWritten) {
      // a. Write row to rumble_daily_result (distributed=false) — new row
      var rowData = [
        dateStr, seedHex, rank, winner.user_id, displayName,
        winner.rp, winner.weight, bpAmount, false, participants.length, nowJst
      ];
      resultSheet.appendRow(rowData);
      SpreadsheetApp.flush();

      // b. Grant BP to winner (only if row was freshly written)
      for (var k = 1; k < appliesData.length; k++) {
        if (String(appliesData[k][aIdx["login_id"]]) === winner.user_id) {
          var currentBp = Number(appliesData[k][aIdx["bp_balance"]] || 0);
          var newBp     = Math.round((currentBp + bpAmount) * 100) / 100;
          appliesSheet.getRange(k + 1, aIdx["bp_balance"] + 1).setValue(newBp);
          appliesData[k][aIdx["bp_balance"]] = newBp; // update local cache
          break;
        }
      }
      SpreadsheetApp.flush();

      // c. Record to wallet_ledger
      appendWalletLedger_({
        kind:     "rumble_daily_bp",
        login_id: winner.user_id,
        email:    email,
        amount:   bpAmount,
        memo:     dateStr + " 日次BP抽選 " + rank + "位",
      });
    } else {
      Logger.log("[rumbleDailyLottery_] rank=" + rank + " row exists (distributed=false), resuming from distributed=true step");
    }

    // d. Mark distributed=true (re-read sheet to get fresh row number)
    var rData2 = resultSheet.getDataRange().getValues();
    var rH2    = rData2[0];
    var rI2    = {};
    rH2.forEach(function(h, i) { rI2[h] = i; });
    for (var ri = 1; ri < rData2.length; ri++) {
      if (String(rData2[ri][rI2["date"]]) === dateStr &&
          Number(rData2[ri][rI2["rank"]]) === rank) {
        resultSheet.getRange(ri + 1, rI2["distributed"] + 1).setValue(true);
        break;
      }
    }
    SpreadsheetApp.flush();

    distributed++;
    Logger.log("[rumbleDailyLottery_] rank=" + rank +
      " user_id=" + winner.user_id +
      " rp=" + winner.rp +
      " weight=" + winner.weight +
      " bp=" + bpAmount);
  }

  Logger.log("[rumbleDailyLottery_] date=" + dateStr +
    " participant_count=" + participants.length +
    " winnerCount=" + winnerCount +
    " distributed=" + distributed);
  return json_({ ok: true, distributed: distributed, date: dateStr, participant_count: participants.length });
}

/** Called by GAS time trigger (毎日 18:50〜19:59 JST を目標に atHour(18)+atHour(19) の2本で登録) */
function rumbleDailyLotteryTrigger_() {
  // GASトリガーは指定時間帯のどこかで発火するため、18:50以前は何もしない
  var nowJst   = new Date(Date.now() + 9 * 60 * 60 * 1000);
  var jstHour  = nowJst.getUTCHours();
  var jstMin   = nowJst.getUTCMinutes();
  if (jstHour < 18 || (jstHour === 18 && jstMin < 50)) {
    Logger.log("[rumbleDailyLotteryTrigger_] Too early (JST " + jstHour + ":" + jstMin + "), skipping.");
    return;
  }
  var today = getTodayJst_();
  rumbleDailyLottery_({ date: today });
  // 抽選完了後にバトルログを生成・シートに保存（翌日以降も確実に取得できるようにする）
  rumbleSpectator_({ date: today });
}

// ============================================================
// action: rumble_daily_result（日次抽選結果を返す。Next.js APIから呼ばれる）
// ============================================================
function rumbleDailyResult_(params) {
  var dateStr  = String(params.date || getTodayJst_());
  var todayStr = getTodayJst_();
  var isToday  = dateStr === todayStr;
  // Deadline same as lottery filter
  var deadline = dateStr + "T18:50:00.000Z";

  // --- Participants ---
  var entrySheet = getRumbleEntrySheet_();
  ensureRumbleEntryCols_(entrySheet);
  var entryData = entrySheet.getDataRange().getValues();
  var eHeaders  = entryData[0];
  var eIdx      = {};
  eHeaders.forEach(function(h, i) { eIdx[h] = i; });

  // 表示用：deadline フィルターなし（当日エントリー全員を見せる）
  var rawParticipants = [];
  // lottery 判定用：deadline フィルターあり（抽選対象者数で isReady を判断）
  var lotteryParticipants = [];
  for (var i = 1; i < entryData.length; i++) {
    var row = entryData[i];
    if (rumbleDateStr_(row[eIdx["date"]]) !== dateStr) continue;
    var createdAt = String(row[eIdx["created_at"]] || "");
    rawParticipants.push({
      user_id:    String(row[eIdx["user_id"]]),
      created_at: createdAt,
    });
    if (!createdAt || createdAt <= deadline) {
      lotteryParticipants.push({ user_id: String(row[eIdx["user_id"]]) });
    }
  }
  var participantCount    = rawParticipants.length;
  var expectedWinnerCount = Math.min(5, lotteryParticipants.length);

  // --- Display names ---
  var appliesSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("applies");
  var appliesData  = appliesSheet.getDataRange().getValues();
  var aHeaders     = appliesData[0];
  var aIdx         = {};
  aHeaders.forEach(function(h, i) { aIdx[h] = i; });
  var displayNameMap = {};
  for (var j = 1; j < appliesData.length; j++) {
    var uid = String(appliesData[j][aIdx["login_id"]]);
    displayNameMap[uid] = String(appliesData[j][aIdx["rumble_display_name"]] || uid);
  }

  // --- Lottery results ---
  var resultSheet = getRumbleDailyResultSheet_();
  ensureRumbleDailyResultCols_(resultSheet);
  var resultData = resultSheet.getDataRange().getValues();
  var rHeaders   = resultData[0];
  var rIdx       = {};
  rHeaders.forEach(function(h, i) { rIdx[h] = i; });

  var winners = [];
  for (var i = 1; i < resultData.length; i++) {
    if (String(resultData[i][rIdx["date"]]) !== dateStr) continue;
    if (String(resultData[i][rIdx["distributed"]]) !== "true") continue;
    var rank = Number(resultData[i][rIdx["rank"]]);
    winners.push({
      rank:         rank,
      user_id:      String(resultData[i][rIdx["user_id"]]),
      display_name: String(resultData[i][rIdx["display_name"]]),
      bp_amount:    Number(resultData[i][rIdx["bp_amount"]]),
      // rp and weight intentionally omitted from response
    });
  }
  winners.sort(function(a, b) { return a.rank - b.rank; });

  // --- Status: ready only if all expected ranks are distributed ---
  // winners.length > 0 の場合はlotteryが実行済み → 実際の当選者数を使う
  // （19:00以降エントリーでlotteryParticipantsが0でも正しくreadyになる）
  var effectiveWinnerCount = winners.length > 0 ? winners.length : expectedWinnerCount;
  var rankSet = {};
  winners.forEach(function(w) { rankSet[w.rank] = true; });
  var allRanksPresent = true;
  for (var r = 1; r <= effectiveWinnerCount; r++) {
    if (!rankSet[r]) { allRanksPresent = false; break; }
  }
  var isReady = effectiveWinnerCount > 0 &&
    winners.length === effectiveWinnerCount &&
    allRanksPresent;

  if (isReady) {
    return json_({
      ok:               true,
      status:           "ready",
      date:             dateStr,
      participant_count: participantCount,
      winnerCount:      effectiveWinnerCount,
      isToday:          isToday,
      replay_seed:      computeSeed_(dateStr), // sha256 hex only, SALT never exposed
      winners:          winners,
    });
  }

  // --- Pending: return participants list (display_name only, created_at order) ---
  var participants = rawParticipants.map(function(p) {
    return {
      user_id:      p.user_id,
      display_name: displayNameMap[p.user_id] || p.user_id,
    };
  });
  return json_({
    ok:               true,
    status:           "pending",
    date:             dateStr,
    participant_count: participantCount,
    winnerCount:      expectedWinnerCount,
    isToday:          isToday,
    participants:     participants,
  });
}

// ============================================================
// EQUIPMENT ENHANCE & DISMANTLE
// ============================================================

function getUserShards_(userId) {
  var sheet   = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("applies");
  var data    = sheet.getDataRange().getValues();
  var headers = data[0];
  var idx     = {};
  headers.forEach(function(h, i) { idx[h] = i; });

  // upgrade_shard列がなければ追加してデータを再取得
  if (idx["upgrade_shard"] === undefined) {
    var newCol = headers.length + 1;
    sheet.getRange(1, newCol).setValue("upgrade_shard");
    // 再取得
    data    = sheet.getDataRange().getValues();
    headers = data[0];
    idx     = {};
    headers.forEach(function(h, i) { idx[h] = i; });
  }

  for (var i = 1; i < data.length; i++) {
    if (String(data[i][idx["login_id"]]) === userId) {
      return {
        rowNum: i + 1,
        shards: Number(data[i][idx["upgrade_shard"]] || 0),
        idx:    idx,
        sheet:  sheet
      };
    }
  }
  return null;
}

function setUserShards_(sheet, rowNum, idx, value) {
  sheet.getRange(rowNum, idx["upgrade_shard"] + 1).setValue(value);
}

function ensureEquipmentNewCols_(sheet) {
  var headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  var required = ["enhance_level","enhance_bonus","luck","stability","quality","locked"];
  required.forEach(function(col) {
    if (headers.indexOf(col) === -1) {
      var newCol = sheet.getLastColumn() + 1;
      sheet.getRange(1, newCol).setValue(col);
      headers.push(col);
    }
  });
}

function getEquipmentItem_(userId, itemId) {
  var sheet = getEquipmentSheet_();
  ensureEquipmentCols_(sheet);
  var data    = sheet.getDataRange().getValues();
  var headers = data[0];
  var idx     = {};
  headers.forEach(function(h, i) { idx[h] = i; });
  for (var i = 1; i < data.length; i++) {
    if (String(data[i][idx["id"]]) === itemId &&
        String(data[i][idx["user_id"]]) === userId) {
      return { row: data[i], rowNum: i + 1, idx: idx, sheet: sheet };
    }
  }
  return null;
}

// action: rumble_dismantle（装備分解）
function rumbleDismantle_(params) {
  var userId = String(params.userId || "");
  var itemId = String(params.itemId || "");
  if (!userId || !itemId) return json_({ ok: false, error: "params_required" });

  // equipmentシートの新カラムを保証
  ensureEquipmentNewCols_(getEquipmentSheet_());

  var found = getEquipmentItem_(userId, itemId);
  if (!found) return json_({ ok: false, error: "item_not_found" });

  var row = found.row;
  var idx = found.idx;

  // ロック中は分解不可
  if (String(row[idx["locked"]]) === "true") return json_({ ok: false, error: "item_locked" });

  // shard計算
  var SHARD_BASE = { common: 1, rare: 3, epic: 10, legendary: 40, mythic: 300 };
  var rarity       = String(row[idx["rarity"]]);
  var enhanceLevel = Number(row[idx["enhance_level"]] || 0);
  var quality      = Number(row[idx["quality"]] || 100);
  var baseShard    = SHARD_BASE[rarity] || 1;
  var bonusShard   = enhanceLevel; // +1ごとに+1
  if (quality >= 115) bonusShard += 8;
  else if (quality >= 110) bonusShard += 3;
  var totalShard   = baseShard + bonusShard;

  // appliesシートのupgrade_shardを更新
  var userData = getUserShards_(userId);
  if (!userData) return json_({ ok: false, error: "user_not_found" });
  var newShards = userData.shards + totalShard;
  setUserShards_(userData.sheet, userData.rowNum, userData.idx, newShards);

  // 装備削除（行削除）
  found.sheet.deleteRow(found.rowNum);

  return json_({ ok: true, gained_shard: totalShard, remaining_shard: newShards });
}

// action: rumble_enhance（装備強化）
function rumbleEnhance_(params) {
  var userId = String(params.userId || "");
  var itemId = String(params.itemId || "");
  if (!userId || !itemId) return json_({ ok: false, error: "params_required" });

  var ENHANCE_TABLE = [
    { cost: 5,   rate: 1.00, main: 1, sub: 0     },
    { cost: 8,   rate: 1.00, main: 1, sub: 0     },
    { cost: 12,  rate: 1.00, main: 1, sub: 0.02  },
    { cost: 18,  rate: 0.95, main: 1, sub: 0     },
    { cost: 25,  rate: 0.90, main: 2, sub: 0.03  },
    { cost: 35,  rate: 0.80, main: 1, sub: 0     },
    { cost: 50,  rate: 0.70, main: 2, sub: 0.05  },
    { cost: 70,  rate: 0.55, main: 1, sub: 0     },
    { cost: 95,  rate: 0.40, main: 2, sub: 0.05  },
    { cost: 130, rate: 0.25, main: 3, sub: 0.10  },
  ];

  // equipmentシートの新カラムを保証
  ensureEquipmentNewCols_(getEquipmentSheet_());

  var found = getEquipmentItem_(userId, itemId);
  if (!found) return json_({ ok: false, error: "item_not_found" });

  var row          = found.row;
  var idx          = found.idx;
  var enhanceLevel = Number(row[idx["enhance_level"]] || 0);

  if (enhanceLevel >= 10) return json_({ ok: false, error: "max_enhance_reached" });

  var tableEntry = ENHANCE_TABLE[enhanceLevel];
  var cost       = tableEntry.cost;

  // shard残高確認
  var userData = getUserShards_(userId);
  if (!userData) return json_({ ok: false, error: "user_not_found" });
  if (userData.shards < cost) return json_({ ok: false, error: "insufficient_shard", shards: userData.shards });

  // shard消費
  var newShards = userData.shards - cost;
  setUserShards_(userData.sheet, userData.rowNum, userData.idx, newShards);

  // 成功判定
  var success = Math.random() < tableEntry.rate;
  if (!success) {
    return json_({
      ok: true, result: "fail",
      before_level: enhanceLevel, after_level: enhanceLevel,
      shard_spent: cost, remaining_shard: newShards
    });
  }

  // 強化適用
  var newLevel       = enhanceLevel + 1;
  var currentBonus   = Number(row[idx["bonus"]] || 0);
  var newBonus       = Math.round((currentBonus + tableEntry.main) * 100) / 100;
  var newLuck        = Number(row[idx["luck"]] || 0);
  var newStability   = Number(row[idx["stability"]] || 0);
  if (tableEntry.sub > 0) {
    newLuck      = Math.round(newLuck * (1 + tableEntry.sub) * 100) / 100;
    newStability = Math.round(newStability * (1 + tableEntry.sub) * 100) / 100;
  }

  found.sheet.getRange(found.rowNum, idx["enhance_level"] + 1).setValue(newLevel);
  found.sheet.getRange(found.rowNum, idx["bonus"] + 1).setValue(newBonus);
  found.sheet.getRange(found.rowNum, idx["luck"] + 1).setValue(newLuck);
  found.sheet.getRange(found.rowNum, idx["stability"] + 1).setValue(newStability);

  return json_({
    ok: true, result: "success",
    before_level: enhanceLevel, after_level: newLevel,
    shard_spent: cost, remaining_shard: newShards,
    updated: { bonus: newBonus, luck: newLuck, stability: newStability }
  });
}

// action: rumble_my_rank_context（自分順位コンテキスト）
function rumbleMyRankContext_(params) {
  var userId = String(params.userId || "");
  var weekId = params.weekId || getWeekId_();

  var REWARD_TIERS = [
    { label: "1位",       ep: 1500, rank_min: 1,  rank_max: 1   },
    { label: "2位",       ep: 1000, rank_min: 2,  rank_max: 2   },
    { label: "3位",       ep: 700,  rank_min: 3,  rank_max: 3   },
    { label: "4〜10位",   ep: 400,  rank_min: 4,  rank_max: 10  },
    { label: "11〜50位",  ep: 80,   rank_min: 11, rank_max: 50  },
    { label: "51〜100位", ep: 10,   rank_min: 51, rank_max: 100 },
  ];

  var weekSheet = getRumbleWeekSheet_();
  ensureRumbleWeekCols_(weekSheet);
  var weekData = weekSheet.getDataRange().getValues();
  var wHeaders = weekData[0];
  var wIdx     = {};
  wHeaders.forEach(function(h, i) { wIdx[h] = i; });

  // applies から display_name マップを構築
  var appliesSheet2 = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("applies");
  var appliesData2  = appliesSheet2.getDataRange().getValues();
  var aHeaders2     = appliesData2[0];
  ensureCols_(appliesSheet2, aHeaders2, ["rumble_display_name"]);
  var aIdx2 = {};
  aHeaders2.forEach(function(h, i) { aIdx2[h] = i; });
  var displayNameMap2 = {};
  for (var di = 1; di < appliesData2.length; di++) {
    var duid = String(appliesData2[di][aIdx2["login_id"]] || "");
    if (duid) displayNameMap2[duid] = String(appliesData2[di][aIdx2["rumble_display_name"]] || "");
  }

  var rows = weekData.slice(1)
    .filter(function(row) { return String(row[wIdx["week_id"]]) === weekId; })
    .map(function(row) {
      var uid = String(row[wIdx["user_id"]]);
      return { user_id: uid, total_rp: Number(row[wIdx["total_rp"]] || 0), display_name: displayNameMap2[uid] || "" };
    });
  rows.sort(function(a, b) { return b.total_rp - a.total_rp; });

  var myRank = -1;
  var myRp   = 0;
  for (var i = 0; i < rows.length; i++) {
    if (rows[i].user_id === userId) { myRank = i + 1; myRp = rows[i].total_rp; break; }
  }
  if (myRank === -1) return json_({ ok: true, not_entered: true, week_id: weekId });

  // 現在tier
  var currentTier = null;
  for (var t = 0; t < REWARD_TIERS.length; t++) {
    if (myRank >= REWARD_TIERS[t].rank_min && myRank <= REWARD_TIERS[t].rank_max) {
      currentTier = REWARD_TIERS[t]; break;
    }
  }

  // 上位tier
  var tierIdx    = REWARD_TIERS.indexOf(currentTier);
  var nextBetter = null;
  if (tierIdx > 0) {
    var betterTier = REWARD_TIERS[tierIdx - 1];
    var targetRank = betterTier.rank_max;
    var targetRp   = targetRank <= rows.length ? rows[targetRank - 1].total_rp : 0;
    nextBetter = { label: betterTier.label, ep: betterTier.ep, target_rank: targetRank, target_rp: targetRp, rp_needed: Math.max(0, targetRp - myRp + 1) };
  }

  // 下位tier
  var nextWorse = null;
  if (tierIdx < REWARD_TIERS.length - 1) {
    var worseTier  = REWARD_TIERS[tierIdx + 1];
    var worseRank  = worseTier.rank_min;
    var worseRp    = worseRank <= rows.length ? rows[worseRank - 1].total_rp : 0;
    nextWorse = { label: worseTier.label, ep: worseTier.ep, target_rank: worseRank, rp_buffer: Math.max(0, myRp - worseRp) };
  }

  // 自分周辺3人
  var surrounding = rows.slice(Math.max(0, myRank - 4), myRank + 3)
    .map(function(r, i) { return { rank: Math.max(1, myRank - 3) + i, user_id: r.user_id, display_name: r.display_name, total_rp: r.total_rp, is_me: r.user_id === userId }; });

  return json_({
    ok: true, week_id: weekId,
    my_rank: myRank, my_rp: myRp,
    current_tier: currentTier,
    next_better_tier: nextBetter,
    next_worse_tier: nextWorse,
    surrounding: surrounding,
  });
}

// ==============================
// GiftEP以降に追加: ランブル観戦用 seeded random
// ==============================
function rumbleSeedRandom_(seed) {
  // xoshiro128** ライクな軽量実装
  var s = seed;
  return function() {
    s = (s ^ (s << 13)) >>> 0;
    s = (s ^ (s >> 17)) >>> 0;
    s = (s ^ (s << 5))  >>> 0;
    return (s >>> 0) / 4294967296;
  };
}

function rumbleMakeSeed_(dateStr, players) {
  // "YYYY-MM-DD|total|uid1:score1|uid2:score2|..."
  var parts = [dateStr, String(players.length)];
  players.forEach(function(p) { parts.push(p.id + ":" + p.score); });
  var str = parts.join("|");
  // 文字列をuint32へハッシュ（djb2ライク）
  var h = 5381;
  for (var i = 0; i < str.length; i++) {
    h = (((h << 5) + h) + str.charCodeAt(i)) >>> 0;
  }
  return h || 1; // 0は避ける
}

// ============================================================
// action: rumble_spectator（観戦モード用データ生成）
// ============================================================
function rumbleSpectator_(params) {
  var userId  = String(params.userId || "");
  var dateStr = String(params.date || getTodayJst_());
  var weekId  = getWeekId_();

  // キャッシュチェック: rumble_battle_log に保存済みデータがあれば返す
  var cachedLog = getBattleLogCache_(dateStr);
  if (cachedLog) {
    var cachedSelf = null;
    for (var ci = 0; ci < cachedLog.players.length; ci++) {
      if (cachedLog.players[ci].id === userId) {
        cachedSelf = cachedLog.players[ci];
        break;
      }
    }
    // week_rp / week_rank を rumble_week シートから補完
    if (cachedSelf && userId) {
      var cWeekSheet = getRumbleWeekSheet_();
      var cWeekData  = cWeekSheet.getDataRange().getValues();
      var cWHeaders  = cWeekData[0];
      var cWIdx      = {};
      cWHeaders.forEach(function(h, i) { cWIdx[h] = i; });
      var cWeekRp = 0; var cWeekRank = -1; var cRankCounter = 0;
      var cWeekRows = cWeekData.slice(1)
        .filter(function(row) { return String(row[cWIdx["week_id"]]) === weekId; })
        .map(function(row) { return { user_id: String(row[cWIdx["user_id"]]), total_rp: Number(row[cWIdx["total_rp"]] || 0) }; });
      cWeekRows.sort(function(a, b) { return b.total_rp - a.total_rp; });
      cWeekRows.forEach(function(r, i) {
        if (r.user_id === userId) { cWeekRp = r.total_rp; cWeekRank = i + 1; }
      });
      cachedSelf = {
        id: cachedSelf.id, display_name: cachedSelf.display_name,
        score: cachedSelf.score, rp: cachedSelf.rp,
        rank: cachedSelf.rank, is_self: true,
        week_rp: cWeekRp, week_rank: cWeekRank,
      };
    }
    return json_({
      ok:      true,
      status:  "ready",
      date:    dateStr,
      players: cachedLog.players,
      events:  cachedLog.events,
      self:    cachedSelf,
      ranking: cachedLog.ranking,
      total:   cachedLog.total,
    });
  }

  // 1. 本日の rumble_entry を取得
  var entrySheet = getRumbleEntrySheet_();
  ensureRumbleEntryCols_(entrySheet);
  var entryData = entrySheet.getDataRange().getValues();
  var eHeaders  = entryData[0];
  var eIdx      = {};
  eHeaders.forEach(function(h, i) { eIdx[h] = i; });

  var todayEntries = [];
  for (var i = 1; i < entryData.length; i++) {
    if (rumbleDateStr_(entryData[i][eIdx["date"]]) === dateStr) {
      todayEntries.push({
        user_id: String(entryData[i][eIdx["user_id"]]),
        score:   Number(entryData[i][eIdx["score"]] || 0),
        rp:      Number(entryData[i][eIdx["rp"]] || 0),
      });
    }
  }

  if (todayEntries.length === 0) {
    return json_({ ok: true, status: "no_data", players: [], events: [], self: null, ranking: [], total: 0 });
  }

  // 2. applies から display_name を取得
  var appliesSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("applies");
  var appliesData  = appliesSheet.getDataRange().getValues();
  var appliesIdx   = {};
  appliesData[0].forEach(function(h, i) { appliesIdx[h] = i; });
  var displayNameMap = {};
  for (var ai = 1; ai < appliesData.length; ai++) {
    var aId   = String(appliesData[ai][appliesIdx["login_id"]] || "");
    var aName = ("rumble_display_name" in appliesIdx)
      ? String(appliesData[ai][appliesIdx["rumble_display_name"]] || "")
      : "";
    if (aId) displayNameMap[aId] = aName || aId;
  }

  // 3. プレイヤーリスト生成（score降順ソート）
  todayEntries.sort(function(a, b) { return b.score - a.score; });
  var players = todayEntries.map(function(e, i) {
    return {
      id:           e.user_id,
      display_name: displayNameMap[e.user_id] || e.user_id,
      score:        e.score,
      rp:           e.rp,
      rank:         i + 1,
      is_self:      e.user_id === userId,
    };
  });

  var total = players.length;

  // seeded random（同日・同参加者・同scoreで同じ演出になる）
  var seed = rumbleMakeSeed_(dateStr, players);
  var rand = rumbleSeedRandom_(seed);

  var events = [];

  // ==============================
  // 少人数分岐
  // ==============================

  if (total === 1) {
    // 1人: 自動優勝
    events.push({ type: "intro", text: "ランブルが はじまる！", delay: 0 });
    events.push({ type: "log",   text: "唯一の挑戦者が戦場に立った！", delay: 800 });
    events.push({ type: "ranking", delay: 1800 });
    events.push({ type: "result", text: "🏆 " + players[0].display_name + " が本日の勝者となった！", delay: 3200 });

  } else if (total === 2) {
    // 2人: 1戦で決着
    var isCrit2 = rand() < 0.1;
    var dmg2 = Math.floor(players[0].score / 10) + Math.floor(rand() * 11);
    var battleText2 = isCrit2
      ? players[1].display_name + " が おそいかかる！\n" + players[0].display_name + " の かいしんの うけ！\n" + dmg2 * 2 + " ダメージを はじき返した！！"
      : players[1].display_name + " が おそいかかる！\n" + players[0].display_name + " は うけとめた！\n" + dmg2 + " ダメージ！";
    events.push({ type: "intro", text: "ランブルが はじまる！", delay: 0 });
    events.push({ type: "log",   text: "きょうの せんしは 2にん！\nさいごまで たたかえ！", delay: 800 });
    events.push({ type: "battle", a: players[1].id, b: players[0].id, text: battleText2, is_crit: isCrit2, delay: 2000 });
    events.push({ type: "ranking", delay: 3800 });
    events.push({ type: "result", text: "🏆 " + players[0].display_name + " が本日の勝者となった！", delay: 5300 });

  } else if (total === 3) {
    // 3人: 最下位を先に落とし、上位2人で決着
    var isCrit3 = rand() < 0.1;
    var dmg3 = Math.floor(players[0].score / 10) + Math.floor(rand() * 11);
    events.push({ type: "intro", text: "ランブルが はじまる！", delay: 0 });
    events.push({ type: "log",   text: "きょうの せんしは 3にん！\nはげしい たたかいが はじまる！", delay: 800 });
    events.push({ type: "batch_eliminate", ids: [players[2].id], text: "1にん が だつらく！\nのこり 2にん！", delay: 2000 });
    events.push({
      type: "battle", a: players[1].id, b: players[0].id,
      text: isCrit3
        ? players[1].display_name + " が おそいかかる！\n" + players[0].display_name + " は うけとめた！\n会心の一撃！ " + dmg3 * 2 + " ダメージ！！"
        : players[1].display_name + " が おそいかかる！\n" + players[0].display_name + " は うけとめた！\n" + dmg3 + " ダメージ！",
      is_crit: isCrit3, delay: 4000,
    });
    events.push({ type: "ranking", delay: 5800 });
    events.push({ type: "result", text: "🏆 " + players[0].display_name + " が本日の勝者となった！", delay: 7300 });

  } else {
    // 4人以上: 既存waveロジック
    var remaining = total;
    var target3 = Math.max(3, Math.floor(total * 0.03));
    var eliminate1 = Math.floor((remaining - target3) * 0.45);
    remaining -= eliminate1;
    var eliminate2 = Math.floor((remaining - target3) * 0.45);
    remaining -= eliminate2;
    var eliminate3 = Math.floor((remaining - target3) * 0.55);
    remaining -= eliminate3;
    var eliminate4 = remaining - 3;
    if (eliminate4 < 0) eliminate4 = 0;

    var waves = [eliminate1, eliminate2, eliminate3, eliminate4].filter(function(n) { return n > 0; });

    var eliminated = 0;
    var waveDelay  = 2000;

    events.push({ type: "intro", text: "ランブルが はじまる！", delay: 0 });
    events.push({ type: "log",   text: "きょうの せんしは " + total + "にん！", delay: 800 });

    var phaseNames = ["序盤戦", "中盤戦", "終盤戦", "決戦"];
    var phaseTexts = [
      "せんじょうは だいこんらん！\nよわった ものたちが のみこまれていく！",
      "たたかいは さらに はげしさを ます！",
      "のこるは つわもの ばかり！",
      "さいごの けっせんが はじまる！",
    ];

    waves.forEach(function(waveCount, waveIdx) {
      if (waveCount <= 0) return;

      events.push({ type: "log", text: phaseTexts[waveIdx] || "たたかいが つづく！", delay: waveDelay });
      waveDelay += 1500;

      var eliminateStart = total - eliminated - waveCount;
      var eliminateIds   = players
        .slice(eliminateStart, eliminateStart + waveCount)
        .map(function(p) { return p.id; });

      eliminated += waveCount;
      var nowRemaining = total - eliminated;

      events.push({
        type:  "batch_eliminate",
        ids:   eliminateIds,
        text:  waveCount + "にん が だつらく！\nのこり " + nowRemaining + "にん！",
        phase: phaseNames[waveIdx] || "終盤",
        delay: waveDelay,
      });
      waveDelay += 2000;

      // 注目戦（seeded random使用）
      var battleCount = waveIdx >= 2 ? 3 : 2;
      var survivingPlayers = players.filter(function(p) {
        return eliminateIds.indexOf(p.id) === -1 &&
               players.indexOf(p) < (total - eliminated);
      });

      var featured = survivingPlayers.filter(function(p) { return p.is_self || p.rank <= 10; });
      var others   = survivingPlayers.filter(function(p) { return !p.is_self && p.rank > 10; });

      for (var b = 0; b < battleCount && survivingPlayers.length >= 2; b++) {
        var playerA = featured.length > 0
          ? featured[Math.floor(rand() * featured.length)]
          : survivingPlayers[Math.floor(rand() * survivingPlayers.length)];
        var playerB = others.length > 0
          ? others[Math.floor(rand() * others.length)]
          : survivingPlayers[Math.floor(rand() * survivingPlayers.length)];

        if (!playerA || !playerB || playerA.id === playerB.id) continue;

        var damage  = Math.floor(playerA.score / 10) + Math.floor(rand() * 11);
        var isCrit  = rand() < 0.1;
        var atkText = isCrit
          ? playerA.display_name + " の かいしんの いちげき！\n" + playerB.display_name + " に " + (damage * 2) + " の ダメージ！！"
          : playerA.display_name + " の こうげき！\n" + playerB.display_name + " に " + damage + " の ダメージ！";

        events.push({
          type: "battle", a: playerA.id, b: playerB.id,
          text: atkText, is_crit: isCrit, delay: waveDelay,
        });
        waveDelay += 1500;
      }
    });

    // TOP3決戦
    events.push({ type: "log", text: "のこり 3にん！\nさいごの つよさが とわれる！", delay: waveDelay });
    waveDelay += 2000;

    var top3 = players.slice(0, 3);
    if (top3.length >= 2) {
      events.push({
        type: "battle", a: top3[1].id, b: top3[0].id,
        text: top3[1].display_name + " が おそいかかる！\n" + top3[0].display_name + " は うけとめた！",
        delay: waveDelay,
      });
      waveDelay += 2000;
    }

    events.push({ type: "ranking", delay: waveDelay });
    events.push({
      type: "result",
      text: "🏆 " + (top3[0] ? top3[0].display_name : "???") + " の かちだ！",
      delay: waveDelay + 1500,
    });
  }

  // 今週のランキングTOP5
  var weekSheet = getRumbleWeekSheet_();
  ensureRumbleWeekCols_(weekSheet);
  var weekData = weekSheet.getDataRange().getValues();
  var wHeaders = weekData[0];
  var wIdx     = {};
  wHeaders.forEach(function(h, i) { wIdx[h] = i; });
  var weekRows = weekData.slice(1)
    .filter(function(row) { return String(row[wIdx["week_id"]]) === weekId; })
    .map(function(row) {
      var uid = String(row[wIdx["user_id"]]);
      return { user_id: uid, display_name: displayNameMap[uid] || uid, total_rp: Number(row[wIdx["total_rp"]] || 0) };
    });
  weekRows.sort(function(a, b) { return b.total_rp - a.total_rp; });

  var selfPlayer = null;
  for (var si = 0; si < players.length; si++) {
    if (players[si].is_self) { selfPlayer = players[si]; break; }
  }
  var selfWeekRp   = 0;
  var selfWeekRank = -1;
  weekRows.forEach(function(r, i) {
    if (r.user_id === userId) { selfWeekRp = r.total_rp; selfWeekRank = i + 1; }
  });

  // バトルログをシートに保存（以降の呼び出しはキャッシュから返す）
  saveBattleLog_(dateStr, players, events, total, weekRows.slice(0, 5));

  return json_({
    ok:      true,
    status:  "ready",
    date:    dateStr,
    players: players,
    events:  events,
    self:    selfPlayer ? { id: selfPlayer.id, display_name: selfPlayer.display_name, score: selfPlayer.score, rp: selfPlayer.rp, rank: selfPlayer.rank, is_self: true, week_rp: selfWeekRp, week_rank: selfWeekRank } : null,
    ranking: weekRows.slice(0, 5),
    total:   total,
  });
}

// action: rumble_force_entry（管理者用：BP消費・参加済みチェックなしで強制バトル参加）
function rumbleForceEntry_(params) {
  var secrets = getSecrets_();
  if (String(params.adminKey || "") !== secrets.ADMIN_SECRET) {
    return json_({ ok: false, error: "admin_unauthorized" });
  }

  var userId = String(params.userId || "");
  if (!userId) return json_({ ok: false, error: "userId_required" });

  var today  = getTodayJst_();
  var weekId = getWeekId_();
  var nowJst = new Date(Date.now() + 9 * 60 * 60 * 1000).toISOString();

  // ユーザー確認
  var appliesSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("applies");
  var appliesData  = appliesSheet.getDataRange().getValues();
  var aHeaders     = appliesData[0];
  var aIdx         = {};
  aHeaders.forEach(function(h, i) { aIdx[h] = i; });

  var userRow = null;
  for (var j = 1; j < appliesData.length; j++) {
    if (String(appliesData[j][aIdx["login_id"]]) === userId) {
      userRow = appliesData[j];
      break;
    }
  }
  if (!userRow) return json_({ ok: false, error: "user_not_found" });

  // スコア計算（BP消費なし）
  var userLevel    = Number(userRow[aIdx["level"]] || 1);
  var levelBonus   = userLevel * 2;
  var equipBonus   = getUserEquipmentBonus_(userId);
  var randomFactor = Math.floor(Math.random() * 51);
  var score        = 100 + levelBonus + equipBonus + randomFactor;
  var rp           = score;

  // rumble_entryに記録
  var entrySheet = getRumbleEntrySheet_();
  ensureRumbleEntryCols_(entrySheet);
  entrySheet.appendRow([Utilities.getUuid(), userId, today, score, rp, nowJst]);

  // rumble_week更新
  var weekSheet = getRumbleWeekSheet_();
  ensureRumbleWeekCols_(weekSheet);
  var weekData   = weekSheet.getDataRange().getValues();
  var wHeaders   = weekData[0];
  var wIdx       = {};
  wHeaders.forEach(function(h, i) { wIdx[h] = i; });
  var weekRowNum = -1;
  var currentRp  = 0;
  for (var k = 1; k < weekData.length; k++) {
    if (String(weekData[k][wIdx["user_id"]]) === userId &&
        String(weekData[k][wIdx["week_id"]]) === weekId) {
      weekRowNum = k + 1;
      currentRp  = Number(weekData[k][wIdx["total_rp"]] || 0);
      break;
    }
  }
  if (weekRowNum === -1) {
    weekSheet.appendRow([userId, weekId, rp, nowJst]);
  } else {
    weekSheet.getRange(weekRowNum, wIdx["total_rp"] + 1).setValue(currentRp + rp);
    weekSheet.getRange(weekRowNum, wIdx["updated_at"] + 1).setValue(nowJst);
  }

  return json_({ ok: true, score: score, rp: rp, week_id: weekId, note: "force_entry_no_bp_deduction" });
}

// action: rumble_force_start（管理者用：承認済み全ユーザーを今日のバトルに強制一括参加）
function rumbleForceStart_(params) {
  var secrets = getSecrets_();
  if (String(params.adminKey || "") !== secrets.ADMIN_SECRET) {
    return json_({ ok: false, error: "admin_unauthorized" });
  }

  var today  = getTodayJst_();
  var weekId = getWeekId_();
  var nowJst = new Date(Date.now() + 9 * 60 * 60 * 1000).toISOString();

  // 今日エントリー済みユーザーセットを作成
  var entrySheet = getRumbleEntrySheet_();
  ensureRumbleEntryCols_(entrySheet);
  var entryData = entrySheet.getDataRange().getValues();
  var eIdx = {};
  entryData[0].forEach(function(h, i) { eIdx[h] = i; });
  var enteredToday = {};
  for (var i = 1; i < entryData.length; i++) {
    if (rumbleDateStr_(entryData[i][eIdx["date"]]) === today) {
      enteredToday[String(entryData[i][eIdx["user_id"]])] = true;
    }
  }

  // approved ユーザー全員取得
  var appliesSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("applies");
  var appliesData  = appliesSheet.getDataRange().getValues();
  var aHeaders     = appliesData[0];
  var aIdx         = {};
  aHeaders.forEach(function(h, i) { aIdx[h] = i; });

  // rumble_week データをプリロード（今週分）
  var weekSheet = getRumbleWeekSheet_();
  ensureRumbleWeekCols_(weekSheet);
  var weekData = weekSheet.getDataRange().getValues();
  var wHeaders = weekData[0];
  var wIdx     = {};
  wHeaders.forEach(function(h, i) { wIdx[h] = i; });
  var weekMap = {};
  for (var k = 1; k < weekData.length; k++) {
    if (String(weekData[k][wIdx["week_id"]]) === weekId) {
      var wUid = String(weekData[k][wIdx["user_id"]]);
      weekMap[wUid] = { rowNum: k + 1, totalRp: Number(weekData[k][wIdx["total_rp"]] || 0) };
    }
  }

  var forced = 0;
  for (var j = 1; j < appliesData.length; j++) {
    var row = appliesData[j];
    if (String(row[aIdx["status"]] || "") !== "approved") continue;
    var uid = String(row[aIdx["login_id"]] || "");
    if (!uid || enteredToday[uid]) continue;

    // スコア計算（BP消費なし）
    var userLevel    = Number(row[aIdx["level"]] || 1);
    var equipBonus   = getUserEquipmentBonus_(uid);
    var randomFactor = Math.floor(Math.random() * 51);
    var score        = 100 + (userLevel * 2) + equipBonus + randomFactor;

    // rumble_entry に記録
    entrySheet.appendRow([Utilities.getUuid(), uid, today, score, score, nowJst]);

    // rumble_week 更新
    if (weekMap[uid]) {
      weekSheet.getRange(weekMap[uid].rowNum, wIdx["total_rp"] + 1).setValue(weekMap[uid].totalRp + score);
      weekSheet.getRange(weekMap[uid].rowNum, wIdx["updated_at"] + 1).setValue(nowJst);
      weekMap[uid].totalRp += score;
    } else {
      weekSheet.appendRow([uid, weekId, score, nowJst]);
      weekMap[uid] = { rowNum: weekSheet.getLastRow(), totalRp: score };
    }

    forced++;
  }

  return json_({ ok: true, forced: forced, week_id: weekId, today: today });
}

// action: rumble_run_now（管理者用：現在のエントリー済み参加者のみで即時バトル実行）
function rumbleRunNow_(params) {
  var secrets = getSecrets_();
  if (String(params.adminKey || "") !== secrets.ADMIN_SECRET) {
    return json_({ ok: false, error: "admin_unauthorized" });
  }
  var today  = getTodayJst_();
  // 現在時刻を deadline として渡す → 今日エントリー済みの全員が対象
  var nowJst = new Date(Date.now() + 9 * 60 * 60 * 1000).toISOString();
  var result = rumbleDailyLottery_({ date: today, deadlineOverride: nowJst });
  var parsed = (result && typeof result.getContent === "function")
    ? JSON.parse(result.getContent())
    : (typeof result === "string" ? JSON.parse(result) : result);
  // バトルログも生成する（rumbleDailyLotteryTrigger_ と同じフローにする）
  rumbleSpectator_({ date: today });
  return json_({ ok: parsed.ok !== false, date: today, distributed: parsed.distributed, error: parsed.error });
}

// action: rumble_set_display_name
function rumbleSetDisplayName_(params) {
  var userId = String(params.userId || "");
  var name   = String(params.display_name || "").trim();
  if (!userId) return json_({ ok: false, error: "userId_required" });
  if (name.length > 16) return json_({ ok: false, error: "name_too_long" });
  if (/[<>"'&\\/]/.test(name)) return json_({ ok: false, error: "invalid_chars" });

  var appliesSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("applies");
  var appliesData  = appliesSheet.getDataRange().getValues();
  var aHeaders     = appliesData[0];
  ensureCols_(appliesSheet, aHeaders, ["rumble_display_name"]);
  var aIdx = {};
  aHeaders.forEach(function(h, i) { aIdx[h] = i; });

  var userRowNum = -1;
  for (var i = 1; i < appliesData.length; i++) {
    if (String(appliesData[i][aIdx["login_id"]]) === userId) {
      userRowNum = i + 1;
      break;
    }
  }
  if (userRowNum === -1) return json_({ ok: false, error: "user_not_found" });

  appliesSheet.getRange(userRowNum, aIdx["rumble_display_name"] + 1).setValue(name);
  return json_({ ok: true, display_name: name });
}

// action: rumble_shard_status（shard残高確認）
function rumbleShardStatus_(params) {
  var userId   = String(params.userId || "");
  var userData = getUserShards_(userId);
  if (!userData) return json_({ ok: false, error: "user_not_found" });
  return json_({ ok: true, shards: userData.shards });
}

// ============================================================
// MUSIC BOOST SYSTEM
// 追加日: 2026-03 / 既存コードへの変更なし・追記のみ
// ============================================================

var MUSIC_BOOST_PLANS = [
  { id: "starter",  percent: 2,  price: 9,    slots: 10  },
  { id: "light",    percent: 5,  price: 29,   slots: 25  },
  { id: "basic",    percent: 10, price: 59,   slots: 50  },
  { id: "growth",   percent: 15, price: 99,   slots: 75  },
  { id: "pro",      percent: 20, price: 149,  slots: 100 },
  { id: "advanced", percent: 25, price: 199,  slots: 125 },
  { id: "premium",  percent: 30, price: 299,  slots: 150 },
  { id: "elite",    percent: 35, price: 499,  slots: 175 },
  { id: "master",   percent: 40, price: 699,  slots: 200 },
  { id: "legend",   percent: 45, price: 1000, slots: 225 },
];
var MUSIC_BOOST_TOTAL_SLOTS = 10000;

function getMusicBoostSheet_() {
  var ss    = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName("music_boost");
  if (!sheet) {
    sheet = ss.insertSheet("music_boost");
    sheet.appendRow([
      "id","user_id","plan_id","percent","price_usd",
      "slots_used","status","started_at","expires_at",
      "canceled_at","updated_at"
    ]);
  }
  return sheet;
}

function getMusicBoostUsedSlots_() {
  var sheet = getMusicBoostSheet_();
  var data  = sheet.getDataRange().getValues();
  if (data.length <= 1) return 0;
  var headers = data[0];
  var idx     = {};
  headers.forEach(function(h, i) { idx[h] = i; });
  var total = 0;
  for (var i = 1; i < data.length; i++) {
    if (String(data[i][idx["status"]]) === "active") {
      total += Number(data[i][idx["slots_used"]] || 0);
    }
  }
  return total;
}

// action: music_boost_status（ユーザーの現在ブースト状況）
function musicBoostStatus_(params) {
  var userId = String(params.userId || "");
  if (!userId) return json_({ ok: false, error: "userId_required" });

  var sheet   = getMusicBoostSheet_();
  var data    = sheet.getDataRange().getValues();
  var headers = data[0];
  var idx     = {};
  headers.forEach(function(h, i) { idx[h] = i; });

  var userBoost  = null;
  for (var i = 1; i < data.length; i++) {
    if (String(data[i][idx["user_id"]]) === userId &&
        String(data[i][idx["status"]])  === "active") {
      userBoost = {
        id:         String(data[i][idx["id"]]),
        plan_id:    String(data[i][idx["plan_id"]]),
        percent:    Number(data[i][idx["percent"]]),
        price_usd:  Number(data[i][idx["price_usd"]]),
        slots_used: Number(data[i][idx["slots_used"]]),
        status:     String(data[i][idx["status"]]),
        started_at: String(data[i][idx["started_at"]]),
        expires_at: String(data[i][idx["expires_at"]]),
      };
      break;
    }
  }

  var usedSlots = getMusicBoostUsedSlots_();
  return json_({
    ok:              true,
    current_boost:   userBoost,
    total_slots:     MUSIC_BOOST_TOTAL_SLOTS,
    used_slots:      usedSlots,
    available_slots: MUSIC_BOOST_TOTAL_SLOTS - usedSlots,
    plans:           MUSIC_BOOST_PLANS,
  });
}

// action: music_boost_subscribe（新規契約・プラン変更）
function musicBoostSubscribe_(params) {
  var userId = String(params.userId || "");
  var planId = String(params.planId || "");
  var paymentMethod = String(params.paymentMethod || "ep");
  if (!userId || !planId) return json_({ ok: false, error: "params_required" });

  // プラン検索
  var plan = null;
  for (var p = 0; p < MUSIC_BOOST_PLANS.length; p++) {
    if (MUSIC_BOOST_PLANS[p].id === planId) { plan = MUSIC_BOOST_PLANS[p]; break; }
  }
  if (!plan) return json_({ ok: false, error: "invalid_plan" });

  var sheet   = getMusicBoostSheet_();
  var data    = sheet.getDataRange().getValues();
  var headers = data[0];
  var idx     = {};
  headers.forEach(function(h, i) { idx[h] = i; });

  // 現在のアクティブブーストを確認
  var currentRow    = -1;
  var currentSlots  = 0;
  for (var i = 1; i < data.length; i++) {
    if (String(data[i][idx["user_id"]]) === userId &&
        String(data[i][idx["status"]])  === "active") {
      currentRow   = i + 1;
      currentSlots = Number(data[i][idx["slots_used"]] || 0);
      break;
    }
  }

  // 枠チェック（既存分を差し引いた差分で確認）
  var usedSlots    = getMusicBoostUsedSlots_();
  var deltaSlots   = plan.slots - currentSlots;
  var availSlots   = MUSIC_BOOST_TOTAL_SLOTS - usedSlots;
  if (deltaSlots > availSlots) {
    return json_({ ok: false, error: "no_slots_available", available: availSlots, needed: deltaSlots });
  }

  // ── EP決済処理 ────────────────────────────────────────────
  if (paymentMethod === "ep") {
    var epCost = plan.price * 100;

    // applies シートからユーザーのEP残高を確認
    var appliesSheet = getOrCreateSheet_();
    var appliesData  = appliesSheet.getDataRange().getValues();
    var appliesHdr   = appliesData[0];
    var appliesIdx   = {};
    appliesHdr.forEach(function(h, i) { appliesIdx[h] = i; });

    var userEp    = 0;
    var userEmail = "";
    for (var ai = 1; ai < appliesData.length; ai++) {
      if (String(appliesData[ai][appliesIdx["login_id"]]) === userId) {
        userEp    = Number(appliesData[ai][appliesIdx["ep_balance"]] || 0);
        userEmail = String(appliesData[ai][appliesIdx["email"]] || "");
        break;
      }
    }

    if (userEp < epCost) {
      return json_({ ok: false, error: "insufficient_ep", balance: userEp, needed: epCost });
    }

    var epResult = mktAdjustEp_(userId, userEmail, -epCost, "music_boost_ep",
                                "Music Boost " + planId + " EP支払い");
    if (!epResult.ok) {
      return json_({ ok: false, error: "ep_deduct_failed", detail: epResult.error });
    }
  }
  // ── EP決済処理ここまで ────────────────────────────────────

  var nowJst    = new Date(Date.now() + 9 * 60 * 60 * 1000).toISOString();
  var expiresAt = new Date(Date.now() + 9 * 60 * 60 * 1000 + 30 * 24 * 60 * 60 * 1000).toISOString();

  // 既存アクティブをcanceledに
  if (currentRow > 0) {
    sheet.getRange(currentRow, idx["status"]      + 1).setValue("canceled");
    sheet.getRange(currentRow, idx["canceled_at"] + 1).setValue(nowJst);
    sheet.getRange(currentRow, idx["updated_at"]  + 1).setValue(nowJst);
  }

  // 新規行追加
  var newId = Utilities.getUuid();
  sheet.appendRow([
    newId, userId, planId, plan.percent, plan.price,
    plan.slots, "active", nowJst, expiresAt, "", nowJst
  ]);

  var returnPayload = {
    ok:         true,
    boost_id:   newId,
    plan_id:    planId,
    percent:    plan.percent,
    price_usd:  plan.price,
    slots_used: plan.slots,
    started_at: nowJst,
    expires_at: expiresAt,
  };
  if (paymentMethod === "ep") {
    returnPayload.ep_cost = plan.price * 100;
  }
  return json_(returnPayload);
}

// action: music_boost_cancel（解約）
function musicBoostCancel_(params) {
  var userId = String(params.userId || "");
  if (!userId) return json_({ ok: false, error: "userId_required" });

  var sheet   = getMusicBoostSheet_();
  var data    = sheet.getDataRange().getValues();
  var headers = data[0];
  var idx     = {};
  headers.forEach(function(h, i) { idx[h] = i; });

  var nowJst = new Date(Date.now() + 9 * 60 * 60 * 1000).toISOString();
  var found  = false;
  for (var i = 1; i < data.length; i++) {
    if (String(data[i][idx["user_id"]]) === userId &&
        String(data[i][idx["status"]])  === "active") {
      sheet.getRange(i + 1, idx["status"]      + 1).setValue("canceled");
      sheet.getRange(i + 1, idx["canceled_at"] + 1).setValue(nowJst);
      sheet.getRange(i + 1, idx["updated_at"]  + 1).setValue(nowJst);
      found = true;
      break;
    }
  }

  if (!found) return json_({ ok: false, error: "no_active_boost" });
  return json_({ ok: true, canceled_at: nowJst });
}

// ── Music Boost 自動更新（時間ベーストリガーから呼び出す）────────────────
function musicBoostAutoRenew_() {
  var nowJst    = new Date(Date.now() + 9 * 60 * 60 * 1000);
  var nowIso    = nowJst.toISOString();

  var boostSheet = getMusicBoostSheet_();
  var boostData  = boostSheet.getDataRange().getValues();
  var boostHdr   = boostData[0];
  var boostIdx   = {};
  boostHdr.forEach(function(h, i) { boostIdx[h] = i; });

  // applies シートを一度だけ読み込む
  var appliesSheet = getOrCreateSheet_();
  var appliesData  = appliesSheet.getDataRange().getValues();
  var appliesHdr   = appliesData[0];
  var appliesIdx   = {};
  appliesHdr.forEach(function(h, i) { appliesIdx[h] = i; });

  for (var i = 1; i < boostData.length; i++) {
    var row = boostData[i];
    if (String(row[boostIdx["status"]]) !== "active") continue;

    var expiresAt = new Date(row[boostIdx["expires_at"]]);
    if (expiresAt > nowJst) continue; // まだ期限切れでない

    var userId = String(row[boostIdx["user_id"]]);
    var planId = String(row[boostIdx["plan_id"]]);
    var rowNum = i + 1; // シートの行番号（ヘッダー含む 1 始まり）

    // プランを検索
    var plan = null;
    for (var p = 0; p < MUSIC_BOOST_PLANS.length; p++) {
      if (MUSIC_BOOST_PLANS[p].id === planId) { plan = MUSIC_BOOST_PLANS[p]; break; }
    }
    if (!plan) {
      console.error("musicBoostAutoRenew_: unknown planId=" + planId + " userId=" + userId);
      continue;
    }

    var epCost = plan.price * 100;

    // ユーザーの EP 残高とメールアドレスを取得
    var userEp    = 0;
    var userEmail = "";
    for (var ai = 1; ai < appliesData.length; ai++) {
      if (String(appliesData[ai][appliesIdx["login_id"]]) === userId) {
        userEp    = Number(appliesData[ai][appliesIdx["ep_balance"]] || 0);
        userEmail = String(appliesData[ai][appliesIdx["email"]] || "");
        break;
      }
    }

    if (userEp >= epCost) {
      // ── EP 差引 ──────────────────────────────────────────────
      var epResult = mktAdjustEp_(userId, userEmail, -epCost, "music_boost_ep_renew",
                                  "Music Boost 自動更新 " + planId);
      if (!epResult.ok) {
        console.error("musicBoostAutoRenew_: mktAdjustEp_ failed userId=" + userId
                      + " error=" + epResult.error);
        continue; // EP 差引失敗時は行を変更しない（二重課金防止）
      }

      // 旧行を expired に更新
      boostSheet.getRange(rowNum, boostIdx["status"]     + 1).setValue("expired");
      boostSheet.getRange(rowNum, boostIdx["updated_at"] + 1).setValue(nowIso);

      // 新行を追加（+30日）
      var newExpiresAt = new Date(nowJst.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString();
      boostSheet.appendRow([
        Utilities.getUuid(), userId, planId, plan.percent, plan.price,
        plan.slots, "active", nowIso, newExpiresAt, "", nowIso
      ]);

    } else {
      // ── EP 不足：失効 + メール ───────────────────────────────
      boostSheet.getRange(rowNum, boostIdx["status"]     + 1).setValue("expired");
      boostSheet.getRange(rowNum, boostIdx["updated_at"] + 1).setValue(nowIso);

      if (userEmail) {
        try {
          MailApp.sendEmail(
            userEmail,
            "【LIFAI】Music Boost の自動更新ができませんでした",
            "Music Boost の自動更新ができませんでした。\n\n" +
            "プラン: " + planId + "（" + plan.percent + "%）\n" +
            "必要 EP: " + epCost + " EP\n" +
            "現在の EP 残高: " + userEp + " EP\n\n" +
            "EP をチャージして再度ご契約いただけます:\n" +
            "https://lifai.vercel.app/music-boost"
          );
        } catch (mailErr) {
          console.error("musicBoostAutoRenew_: mail failed userId=" + userId
                        + " err=" + mailErr);
        }
      }
    }
  }
}
// ── Music Boost 自動更新ここまで ──────────────────────────────────────────

// action: music_boost_admin_list（管理用：全ブースト一覧）
function musicBoostAdminList_(params) {
  var sheet   = getMusicBoostSheet_();
  var data    = sheet.getDataRange().getValues();
  if (data.length <= 1) return json_({ ok: true, boosts: [], used_slots: 0 });

  var headers = data[0];
  var idx     = {};
  headers.forEach(function(h, i) { idx[h] = i; });

  var boosts = data.slice(1).map(function(row) {
    return {
      id:         String(row[idx["id"]]),
      user_id:    String(row[idx["user_id"]]),
      plan_id:    String(row[idx["plan_id"]]),
      percent:    Number(row[idx["percent"]]),
      price_usd:  Number(row[idx["price_usd"]]),
      slots_used: Number(row[idx["slots_used"]]),
      status:     String(row[idx["status"]]),
      started_at: String(row[idx["started_at"]]),
      expires_at: String(row[idx["expires_at"]]),
    };
  });

  var usedSlots = getMusicBoostUsedSlots_();
  return json_({
    ok:              true,
    boosts:          boosts,
    used_slots:      usedSlots,
    total_slots:     MUSIC_BOOST_TOTAL_SLOTS,
    available_slots: MUSIC_BOOST_TOTAL_SLOTS - usedSlots,
  });
}

// action: music_boost_get_info（アーティスト・楽曲情報取得）
function musicBoostGetInfo_(params) {
  var userId = String(params.userId || "");
  if (!userId) return json_({ ok: false, error: "userId_required" });
  var sheet  = getOrCreateSheet_();
  var values = getValuesSafe_(sheet);
  var header = values[0];
  ensureCols_(sheet, header, ["music_boost_artist", "music_boost_album", "music_boost_tracks_json"]);
  values = getValuesSafe_(sheet);
  header = values[0];
  var idx = indexMap_(header);
  for (var i = 1; i < values.length; i++) {
    if (str_(values[i][idx["login_id"]]) === userId) {
      var tracksRaw = str_(values[i][idx["music_boost_tracks_json"]] || "");
      var tracks = [];
      try { if (tracksRaw) tracks = JSON.parse(tracksRaw); } catch(e) {}
      return json_({
        ok:     true,
        artist: str_(values[i][idx["music_boost_artist"]] || ""),
        album:  str_(values[i][idx["music_boost_album"]]  || ""),
        tracks: tracks,
      });
    }
  }
  return json_({ ok: false, error: "user_not_found" });
}

// action: music_boost_update_info（アーティスト・楽曲情報更新）
function musicBoostUpdateInfo_(params) {
  var userId = String(params.userId || "");
  var artist = String(params.artist || "");
  var album  = String(params.album  || "");
  if (!userId) return json_({ ok: false, error: "userId_required" });
  var sheet  = getOrCreateSheet_();
  var values = getValuesSafe_(sheet);
  var header = values[0];
  ensureCols_(sheet, header, ["music_boost_artist", "music_boost_album"]);
  values = getValuesSafe_(sheet);
  header = values[0];
  var idx = indexMap_(header);
  for (var i = 1; i < values.length; i++) {
    if (str_(values[i][idx["login_id"]]) === userId) {
      sheet.getRange(i + 1, idx["music_boost_artist"] + 1).setValue(artist);
      sheet.getRange(i + 1, idx["music_boost_album"]  + 1).setValue(album);
      return json_({ ok: true });
    }
  }
  return json_({ ok: false, error: "user_not_found" });
}
// action: music_boost_set_tracks（楽曲リスト全置換）
function musicBoostSetTracks_(params) {
  var userId = String(params.userId || "");
  var tracks = params.tracks;
  if (!userId) return json_({ ok: false, error: "userId_required" });
  if (!Array.isArray(tracks)) return json_({ ok: false, error: "tracks_must_be_array" });

  // 各エントリを {artist: string, album: string} に正規化
  var sanitized = tracks.map(function(t) {
    return {
      artist: String(t.artist || "").slice(0, 200),
      album:  String(t.album  || "").slice(0, 200),
    };
  });

  var sheet  = getOrCreateSheet_();
  var values = getValuesSafe_(sheet);
  var header = values[0];
  ensureCols_(sheet, header, ["music_boost_tracks_json"]);
  values = getValuesSafe_(sheet);
  header = values[0];
  var idx = indexMap_(header);

  for (var i = 1; i < values.length; i++) {
    if (str_(values[i][idx["login_id"]]) === userId) {
      sheet.getRange(i + 1, idx["music_boost_tracks_json"] + 1).setValue(JSON.stringify(sanitized));
      return json_({ ok: true, tracks: sanitized });
    }
  }
  return json_({ ok: false, error: "user_not_found" });
}
// =========================================================
// gachaDailySpin_（デイリー割引ガチャ：80BP・1日1回・JST日付管理）
// =========================================================
function gachaDailySpin_(body) {
  const secrets = getSecrets_();
  if (str_(body.adminKey) !== secrets.ADMIN_SECRET) {
    return json_({ ok: false, error: "admin_unauthorized" });
  }
  const loginId = str_(body.loginId);
  if (!loginId) return json_({ ok: false, error: "loginId_required" });

  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("applies");
  let values = sheet.getDataRange().getValues();
  let header = values[0];
  ensureCols_(sheet, header, ["login_id","email","bp_balance","gacha_count","gacha_streak","gacha_fragments","daily_gacha_used"]);
  values = sheet.getDataRange().getValues();
  header = values[0];
  const idx  = indexMap_(header);
  const rows = values.slice(1);

  let hitRowIndex = 0;
  let hitEmail    = "";
  for (let i = 0; i < rows.length; i++) {
    if (str_(rows[i][idx["login_id"]]) === loginId) {
      hitRowIndex = i + 2;
      hitEmail    = str_(rows[i][idx["email"]]);
      break;
    }
  }
  if (!hitRowIndex) return json_({ ok: false, error: "not_found" });

  const nowJst   = new Date(Date.now() + 9 * 60 * 60 * 1000);
  const todayStr = nowJst.toISOString().slice(0, 10);
  const lastUsed = str_(sheet.getRange(hitRowIndex, idx["daily_gacha_used"] + 1).getValue()).slice(0, 10);

  if (lastUsed === todayStr) {
    return json_({ ok: false, error: "daily_already_used", next_reset: todayStr + "T15:00:00Z" });
  }

  const DAILY_COST = 80;
  const currentBp  = Number(sheet.getRange(hitRowIndex, idx["bp_balance"]     + 1).getValue() || 0);
  const gachaCount = Number(sheet.getRange(hitRowIndex, idx["gacha_count"]    + 1).getValue() || 0);
  const gachaStreak= Number(sheet.getRange(hitRowIndex, idx["gacha_streak"]   + 1).getValue() || 0);
  const fragments  = Number(sheet.getRange(hitRowIndex, idx["gacha_fragments"]+ 1).getValue() || 0);

  if (currentBp < DAILY_COST) {
    return json_({ ok: false, reason: "insufficient_bp", bp_balance: currentBp });
  }

  const PRIZES  = [5, 10, 20, 40, 80, 150, 300, 600, 1000, 5000, 20000];
  const WEIGHTS = [28, 24, 18, 12, 8, 5, 3, 0.80, 1.00, 0.18, 0.02];
  const RARITY  = ["common","common","common","common","uncommon","uncommon","rare","epic","legendary","mythic","god"];

  const hitPityDaily = gachaCount >= 100; // 天井発動チェック
  let useW = WEIGHTS.slice();
  if (gachaStreak >= 10) useW = [0,0,0,0,0,40,35,18,6,1,0];
  if (hitPityDaily)      useW = [0,0,0,0,0,0,0,0,70,25,5];

  const total = useW.reduce((a,b) => a+b, 0);
  let r = Math.random() * total, c = 0, prize = PRIZES[0], rar = RARITY[0];
  for (let k = 0; k < PRIZES.length; k++) {
    c += useW[k];
    if (r < c) { prize = PRIZES[k]; rar = RARITY[k]; break; }
  }

  const newBp     = currentBp - DAILY_COST + prize;
  const newCount  = (hitPityDaily ? 0 : gachaCount) + 1; // 天井発動後はカウントリセット
  const newStreak = prize < 150 ? gachaStreak + 1 : 0;
  const newFrag   = fragments + 1;

  sheet.getRange(hitRowIndex, idx["bp_balance"]      + 1).setValue(newBp);
  sheet.getRange(hitRowIndex, idx["gacha_count"]     + 1).setValue(newCount);
  sheet.getRange(hitRowIndex, idx["gacha_streak"]    + 1).setValue(newStreak);
  sheet.getRange(hitRowIndex, idx["gacha_fragments"] + 1).setValue(newFrag);
  sheet.getRange(hitRowIndex, idx["daily_gacha_used"]+ 1).setValue(todayStr);

  appendWalletLedger_({ kind: "gacha_cost",  login_id: loginId, email: hitEmail, amount: -DAILY_COST, memo: "デイリーガチャ消費" });
  appendWalletLedger_({ kind: "gacha_prize", login_id: loginId, email: hitEmail, amount: prize,       memo: "デイリーガチャ当選（" + prize + "BP）" });

  if (prize >= 1000) {
    const ss2 = SpreadsheetApp.getActiveSpreadsheet();
    let tickerSheet = ss2.getSheetByName("gacha_ticker");
    if (!tickerSheet) { tickerSheet = ss2.insertSheet("gacha_ticker"); tickerSheet.appendRow(["id","masked_id","prize_bp","created_at"]); }
    const masked = loginId.length > 2 ? loginId.slice(0,2)+"***" : loginId+"***";
    tickerSheet.appendRow([Utilities.getUuid(), masked, prize, new Date().toISOString()]);
  }

  return json_({
    ok:          true,
    cost:        DAILY_COST,
    prize_bp:    prize,
    bp_balance:  newBp,
    net:         prize - DAILY_COST,
    rarity:      rar,
    fragments:   newFrag,
    gacha_count: newCount,
    to_pity:     Math.max(0, 100 - newCount),
  });
}

// =========================================================
// gachaDailyStatus_（デイリーガチャ使用状況確認：認証不要）
// =========================================================
function gachaDailyStatus_(body) {
  const loginId = str_(body.loginId);
  if (!loginId) return json_({ ok: false, error: "loginId_required" });

  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("applies");
  let values = sheet.getDataRange().getValues();
  let header = values[0];
  ensureCols_(sheet, header, ["login_id", "daily_gacha_used"]);
  values = sheet.getDataRange().getValues();
  header = values[0];
  const idx  = indexMap_(header);
  const rows = values.slice(1);

  const nowJst   = new Date(Date.now() + 9 * 60 * 60 * 1000);
  const todayStr = nowJst.toISOString().slice(0, 10);

  for (let i = 0; i < rows.length; i++) {
    if (str_(rows[i][idx["login_id"]]) === loginId) {
      const lastUsed = str_(rows[i][idx["daily_gacha_used"]]).slice(0, 10);
      return json_({ ok: true, used: lastUsed === todayStr });
    }
  }
  return json_({ ok: true, used: false });
}

// ==============================
// GiftEP システム
// ==============================

var GIFT_EP_EXPIRY_DAYS_ = 30;
var GIFT_EP_MAX_SINGLE_  = 10000;
var GIFT_EP_MAX_MONTHLY_ = 50000;
var GIFT_FEATURES_ALLOWED_ = ["musicboost", "workflow"];

function giftGetSheet_(ss, name) {
  var HEADERS = {
    "gift_transactions": [
      "id", "from_user", "to_user", "amount", "created_at",
      "expiry_date", "status", "note", "flagged_reason",
    ],
    "gift_usage_logs": [
      "id", "user_id", "feature_type", "feature_ref",
      "amount", "used_at", "source_expiry_date",
    ],
  };
  return getOrCreateSheetByName_(ss, name, HEADERS[name] || []);
}

function giftGetUserGiftData_(loginId) {
  var sheet = getOrCreateSheet_();
  var values = getValuesSafe_(sheet);
  if (values.length < 2) return null;

  var header = values[0];
  ensureCols_(sheet, header, ["gift_ep_balance", "gift_ep_expiry_map"]);
  var freshValues = getValuesSafe_(sheet);
  var freshIdx = indexMap_(freshValues[0]);
  var rows = freshValues.slice(1);

  for (var i = 0; i < rows.length; i++) {
    if (str_(rows[i][freshIdx["login_id"]]) === loginId) {
      var rawBalance = sheet.getRange(i + 2, freshIdx["gift_ep_balance"] + 1).getValue();
      var rawMap = sheet.getRange(i + 2, freshIdx["gift_ep_expiry_map"] + 1).getValue();
      var expiryMap = {};
      try { expiryMap = JSON.parse(String(rawMap || "{}")); } catch (e) { expiryMap = {}; }
      return {
        balance: num_(rawBalance),
        expiryMap: expiryMap,
        rowIndex: i + 2,
        sheet: sheet,
        idx: freshIdx,
      };
    }
  }
  return null;
}

function giftAdjustGiftEp_(loginId, delta, expiryDate) {
  try {
    const data = giftGetUserGiftData_(loginId);
    if (!data) return { ok: false, error: "user_not_found" };

    const map = data.expiryMap;
    const today = new Date().toISOString().slice(0, 10);
    let newBalance;

    if (delta > 0) {
      // 付与：expiryDateのバケツに加算
      const key = expiryDate;
      map[key] = (map[key] || 0) + delta;
      newBalance = data.balance + delta;
    } else {
      // 消費：期限が近い順に減算（失効済みキーはスキップ）
      const amount = -delta;

      // 有効残高のみで不足チェック
      let validBalance = 0;
      Object.keys(map).forEach(function(d) {
        if (d >= today) validBalance += map[d];
      });
      if (validBalance < amount) return { ok: false, error: "insufficient_gift_ep" };

      const sortedDates = Object.keys(map).sort();
      let remaining = amount;
      for (let j = 0; j < sortedDates.length; j++) {
        const d = sortedDates[j];
        if (d < today) continue; // 失効済みはスキップ
        if (map[d] <= remaining) {
          remaining -= map[d];
          delete map[d];
        } else {
          map[d] -= remaining;
          remaining = 0;
          break;
        }
      }
      // balanceも有効残高ベースで再計算
      let recalc = 0;
      Object.keys(map).forEach(function(d) { if (d >= today) recalc += map[d]; });
      newBalance = recalc;
    }

    data.sheet.getRange(data.rowIndex, data.idx["gift_ep_balance"] + 1).setValue(newBalance);
    data.sheet.getRange(data.rowIndex, data.idx["gift_ep_expiry_map"] + 1).setValue(JSON.stringify(map));
    return { ok: true, new_balance: newBalance };
  } catch (e) {
    return { ok: false, error: String(e) };
  }
}

function giftAuth_(SECRET, id, code) {
  return mktAuth_(SECRET, id, code);
}

function handleGift_(key, body) {
  var secrets = getSecrets_();
  if (key !== secrets.SECRET) return json_({ ok: false, error: "unauthorized" });

  var SECRET = secrets.SECRET;
  var action = str_(body.action);

  // =========================================================
  // gift_balance（GiftEP残高・期限情報取得）
  // =========================================================
  if (action === "gift_balance") {
    const id = str_(body.id);
    const code = str_(body.code);
    if (!id || !code) return json_({ ok: false, error: "missing_auth" });

    const user = giftAuth_(SECRET, id, code);
    if (!user.ok) return json_({ ok: false, error: "auth_failed" });

    const data = giftGetUserGiftData_(user.login_id);
    if (!data) return json_({ ok: false, error: "user_not_found" });

    const today = new Date().toISOString().slice(0, 10);
    const sortedEntries = Object.entries(data.expiryMap)
      .filter(function(e) { return e[0] >= today; })
      .sort(function(a, b) { return a[0].localeCompare(b[0]); });

    let expiringSoon = 0;
    let nextExpiryDate = null;

    for (let i = 0; i < sortedEntries.length; i++) {
      const d = sortedEntries[i][0];
      const amt = sortedEntries[i][1];
      const diffDays = (new Date(d).getTime() - new Date(today).getTime()) / (1000 * 60 * 60 * 24);
      if (diffDays <= 7) expiringSoon += amt;
      if (!nextExpiryDate) nextExpiryDate = d;
    }

    // 有効残高（失効済みを除く）を再計算
    let validBalance = 0;
    sortedEntries.forEach(function(e) { validBalance += e[1]; });

    return json_({
      ok: true,
      balance: validBalance,
      expiring_soon: expiringSoon,
      next_expiry_date: nextExpiryDate,
      expiry_map: data.expiryMap,
    });
  }

  // =========================================================
  // gift_rules_check（特定機能でGiftEPが利用可能か判定）
  // =========================================================
  if (action === "gift_rules_check") {
    const featureType = str_(body.feature_type);
    const allowed = GIFT_FEATURES_ALLOWED_.indexOf(featureType) !== -1;
    return json_({ ok: true, allowed: allowed, feature_type: featureType });
  }

  // =========================================================
  // gift_send（EP送信 → 全量GiftEPへ変換）
  // =========================================================
  if (action === "gift_send") {
    const id = str_(body.id);
    const code = str_(body.code);
    if (!id || !code) return json_({ ok: false, error: "missing_auth" });

    const user = giftAuth_(SECRET, id, code);
    if (!user.ok) return json_({ ok: false, error: "auth_failed" });

    const toUser = str_(body.to_user);
    const amount = num_(body.amount);
    const note = str_(body.note || "").slice(0, 200);

    if (!toUser) return json_({ ok: false, error: "missing_to_user" });
    if (toUser === user.login_id) return json_({ ok: false, error: "cannot_send_to_self" });
    if (amount < 1) return json_({ ok: false, error: "amount_must_be_positive" });
    if (amount > GIFT_EP_MAX_SINGLE_) {
      return json_({ ok: false, error: "exceeds_single_limit", limit: GIFT_EP_MAX_SINGLE_ });
    }

    const lock = LockService.getScriptLock();
    try { lock.waitLock(8000); } catch(e) { return json_({ ok: false, error: "lock_timeout" }); }

    try {
      const ss = SpreadsheetApp.getActiveSpreadsheet();

      // 月間送信上限チェック
      const txSheet = giftGetSheet_(ss, "gift_transactions");
      const txValues = getValuesSafe_(txSheet);
      const nowDate = new Date();
      const ym = nowDate.getFullYear() + "-" + String(nowDate.getMonth() + 1).padStart(2, "0");
      let monthTotal = 0;
      if (txValues.length >= 2) {
        const tHeader = txValues[0];
        const tIdx = indexMap_(tHeader);
        txValues.slice(1).forEach(function(row) {
          if (str_(row[tIdx["from_user"]]) === user.login_id &&
              str_(row[tIdx["status"]]) === "completed" &&
              str_(row[tIdx["created_at"]]).startsWith(ym)) {
            monthTotal += num_(row[tIdx["amount"]]);
          }
        });
      }
      if (monthTotal + amount > GIFT_EP_MAX_MONTHLY_) {
        return json_({
          ok: false,
          error: "exceeds_monthly_limit",
          limit: GIFT_EP_MAX_MONTHLY_,
          used: monthTotal,
        });
      }

      // 受信者の存在確認
      const toUserData = mktGetUserByLoginId_(toUser);
      if (!toUserData) return json_({ ok: false, error: "to_user_not_found" });

      // 送信者のEP残高確認（ロック内で再取得）
      const senderData = mktGetUserByLoginId_(user.login_id);
      if (!senderData || senderData.ep_balance < amount) {
        return json_({ ok: false, error: "insufficient_ep", ep_balance: senderData ? senderData.ep_balance : 0 });
      }

      // EP減算（送信者）
      const debitResult = mktAdjustEp_(user.login_id, user.email, -amount, "gift_send", "to=" + toUser);
      if (!debitResult || !debitResult.ok) {
        return json_({ ok: false, error: "ep_debit_failed", detail: debitResult ? debitResult.error : "unknown" });
      }

      // GiftEP付与（受信者）
      const expiryDate = new Date(nowDate.getTime() + GIFT_EP_EXPIRY_DAYS_ * 24 * 60 * 60 * 1000)
        .toISOString().slice(0, 10);
      const grantResult = giftAdjustGiftEp_(toUser, amount, expiryDate);
      if (!grantResult.ok) {
        // GiftEP付与失敗 → EPを戻す（ロールバック）
        const rollbackResult = mktAdjustEp_(user.login_id, user.email, amount, "gift_send_rollback", "rollback to=" + toUser);
        return json_({ ok: false, error: "gift_grant_failed", detail: grantResult.error, rollback_ok: !!(rollbackResult && rollbackResult.ok) });
      }

      // 取引記録
      const giftId = "GFT_" + Utilities.getUuid().replace(/-/g, "").substring(0, 16).toUpperCase();
      try {
        txSheet.appendRow([
          giftId,                    // id
          user.login_id,             // from_user
          toUser,                    // to_user
          amount,                    // amount
          nowDate.toISOString(),     // created_at
          expiryDate,                // expiry_date
          "completed",               // status
          note,                      // note
          "",                        // flagged_reason
        ]);
      } catch (appendErr) {
        // 記録失敗 → ロールバック
        mktAdjustEp_(user.login_id, user.email, amount, "gift_send_rollback", "append_failed to=" + toUser);
        giftAdjustGiftEp_(toUser, -amount, expiryDate);
        return json_({ ok: false, error: "transaction_record_failed", detail: String(appendErr) });
      }

      return json_({
        ok: true,
        gift_id: giftId,
        amount: amount,
        to_user: toUser,
        expiry_date: expiryDate,
      });
    } finally {
      lock.releaseLock();
    }
  }

  // =========================================================
  // gift_history（送受信・失効履歴取得）
  // =========================================================
  if (action === "gift_history") {
    const id = str_(body.id);
    const code = str_(body.code);
    if (!id || !code) return json_({ ok: false, error: "missing_auth" });

    const user = giftAuth_(SECRET, id, code);
    if (!user.ok) return json_({ ok: false, error: "auth_failed" });

    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const txSheet = giftGetSheet_(ss, "gift_transactions");
    const txValues = getValuesSafe_(txSheet);

    const sent = [];
    const received = [];
    const expired = [];

    if (txValues.length >= 2) {
      const tHeader = txValues[0];
      const tIdx = indexMap_(tHeader);
      txValues.slice(1).forEach(function(row) {
        const fromUser = str_(row[tIdx["from_user"]]);
        const toUser   = str_(row[tIdx["to_user"]]);
        const status   = str_(row[tIdx["status"]]);
        const record = {
          id:           str_(row[tIdx["id"]]),
          from_user:    fromUser,
          to_user:      toUser,
          amount:       num_(row[tIdx["amount"]]),
          created_at:   str_(row[tIdx["created_at"]]),
          expiry_date:  str_(row[tIdx["expiry_date"]]),
          status:       status,
          note:         str_(row[tIdx["note"]]),
        };
        if (fromUser === user.login_id) {
          sent.push(record);
        } else if (toUser === user.login_id) {
          if (status === "expired") {
            expired.push(record);
          } else {
            received.push(record);
          }
        }
      });
    }

    // 新しい順
    const byDate = function(a, b) {
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    };

    return json_({
      ok: true,
      sent: sent.sort(byDate),
      received: received.sort(byDate),
      expired: expired.sort(byDate),
    });
  }

  // =========================================================
  // gift_use（運営コンテンツでGiftEPを消費）
  // =========================================================
  if (action === "gift_use") {
    const id = str_(body.id);
    const code = str_(body.code);
    if (!id || !code) return json_({ ok: false, error: "missing_auth" });

    const user = giftAuth_(SECRET, id, code);
    if (!user.ok) return json_({ ok: false, error: "auth_failed" });

    const featureType = str_(body.feature_type);
    const featureRef  = str_(body.feature_ref || "");
    const amount      = num_(body.amount);

    if (!featureType) return json_({ ok: false, error: "missing_feature_type" });
    if (GIFT_FEATURES_ALLOWED_.indexOf(featureType) === -1) {
      return json_({ ok: false, error: "feature_not_allowed", feature_type: featureType });
    }
    if (amount < 1) return json_({ ok: false, error: "amount_must_be_positive" });

    const lock = LockService.getScriptLock();
    try { lock.waitLock(8000); } catch(e) { return json_({ ok: false, error: "lock_timeout" }); }

    try {
      // 残高確認 & 消費（期限近い順）
      const data = giftGetUserGiftData_(user.login_id);
      if (!data) return json_({ ok: false, error: "user_not_found" });
      if (data.balance < amount) {
        return json_({ ok: false, error: "insufficient_gift_ep", balance: data.balance });
      }

      // 消費する際に使ったexpiryDateを記録用に取得
      const sortedDates = Object.keys(data.expiryMap).sort();
      const sourceExpiryDate = sortedDates.length > 0 ? sortedDates[0] : "";

      const result = giftAdjustGiftEp_(user.login_id, -amount, null);
      if (!result.ok) return json_(result);

      // usage_logs記録
      const ss = SpreadsheetApp.getActiveSpreadsheet();
      const logSheet = giftGetSheet_(ss, "gift_usage_logs");
      const logId = "GUL_" + Utilities.getUuid().replace(/-/g, "").substring(0, 16).toUpperCase();
      logSheet.appendRow([
        logId,            // id
        user.login_id,    // user_id
        featureType,      // feature_type
        featureRef,       // feature_ref
        amount,           // amount
        new Date(),       // used_at
        sourceExpiryDate, // source_expiry_date
      ]);

      return json_({ ok: true, remaining_balance: result.new_balance });
    } finally {
      lock.releaseLock();
    }
  }

  return json_({ ok: false, error: "bad_gift_action" });
}

// ==============================
// GiftEP 失効バッチ（time-based triggerから呼び出す）
// ==============================

function expireGiftEP() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = getOrCreateSheet_(); // applies
  const values = getValuesSafe_(sheet);
  if (values.length < 2) return;

  const header = values[0];
  ensureCols_(sheet, header, ["gift_ep_balance", "gift_ep_expiry_map"]);
  const idx = indexMap_(getValuesSafe_(sheet)[0]);

  const today = new Date().toISOString().slice(0, 10);
  const rows = getValuesSafe_(sheet).slice(1);

  for (var i = 0; i < rows.length; i++) {
    const rawMap = sheet.getRange(i + 2, idx["gift_ep_expiry_map"] + 1).getValue();
    if (!rawMap) continue;
    let expiryMap = {};
    try { expiryMap = JSON.parse(String(rawMap)); } catch(e) { continue; }

    let changed = false;
    let expiredTotal = 0;
    const keys = Object.keys(expiryMap);
    for (var j = 0; j < keys.length; j++) {
      const d = keys[j];
      if (d < today) { // 今日より前は失効
        expiredTotal += expiryMap[d];
        delete expiryMap[d];
        changed = true;
      }
    }

    if (changed) {
      const loginId = str_(rows[i][idx["login_id"]]);
      const curBalance = num_(sheet.getRange(i + 2, idx["gift_ep_balance"] + 1).getValue());
      const newBalance = Math.max(0, curBalance - expiredTotal);
      sheet.getRange(i + 2, idx["gift_ep_balance"] + 1).setValue(newBalance);
      sheet.getRange(i + 2, idx["gift_ep_expiry_map"] + 1).setValue(JSON.stringify(expiryMap));
      Logger.log("expireGiftEP: " + loginId + " expired " + expiredTotal + " GiftEP");
    }
  }

  // gift_transactionsのstatusをexpiredに更新
  const txSheet = giftGetSheet_(ss, "gift_transactions");
  const txValues = getValuesSafe_(txSheet);
  if (txValues.length >= 2) {
    const tHeader = txValues[0];
    const tIdx = indexMap_(tHeader);
    txValues.slice(1).forEach(function(row, ri) {
      if (str_(row[tIdx["expiry_date"]]) < today &&
          str_(row[tIdx["status"]]) === "completed") {
        txSheet.getRange(ri + 2, tIdx["status"] + 1).setValue("expired");
      }
    });
  }
}

// 一度だけ手動実行してtriggerを登録する
function setupGiftExpireTrigger() {
  const triggers = ScriptApp.getProjectTriggers();
  for (var i = 0; i < triggers.length; i++) {
    if (triggers[i].getHandlerFunction() === "expireGiftEP") {
      ScriptApp.deleteTrigger(triggers[i]);
    }
  }
  ScriptApp.newTrigger("expireGiftEP")
    .timeBased()
    .everyDays(1)
    .atHour(2) // AM2時（JST）
    .create();
  Logger.log("expireGiftEP trigger set: daily at 2AM");
}

// ============================================================
// TRIGGER SETUP — run once manually in GAS editor
// ============================================================

/**
 * 毎日18:00〜19:00 JST に発火。昨日より古いバトルログを rumble_battle_log から削除する。
 * 昨日・今日分は保持（前回バトルログ表示のため）。
 */
function rumbleClearOldBattleLogsTrigger_() {
  var sheet = getRumbleBattleLogSheet_();
  var data = sheet.getDataRange().getValues();
  if (data.length < 2) return;
  var headers = data[0];
  var idx = {};
  headers.forEach(function(h, i) { idx[h] = i; });
  var yesterday = new Date(Date.now() + 9 * 60 * 60 * 1000 - 86400000);
  var yesterdayStr = Utilities.formatDate(yesterday, "Asia/Tokyo", "yyyy-MM-dd");
  // 末尾から走査して古い行を削除（行番号がずれないようにするため）
  for (var i = data.length - 1; i >= 1; i--) {
    if (String(data[i][idx["date"]]) < yesterdayStr) {
      sheet.deleteRow(i + 1);
    }
  }
  SpreadsheetApp.flush();
  Logger.log("[rumbleClearOldBattleLogsTrigger_] done. yesterdayStr=" + yesterdayStr);
}

/**
 * Run this function ONCE in the GAS editor to install time triggers.
 * Do NOT call from code — triggers persist across deploys.
 */
function setupRumbleTriggers_() {
  // Remove existing rumble triggers to avoid duplicates
  var triggers = ScriptApp.getProjectTriggers();
  triggers.forEach(function(t) {
    var name = t.getHandlerFunction();
    if (name === "rumbleDailyLotteryTrigger_" || name === "rumbleWeeklyRewardTrigger_" || name === "rumbleClearOldBattleLogsTrigger_") {
      ScriptApp.deleteTrigger(t);
    }
  });

  // Daily lottery: 18:xx (main — fires 18:00–18:59, guard skips if before 18:50)
  ScriptApp.newTrigger("rumbleDailyLotteryTrigger_")
    .timeBased()
    .everyDays(1)
    .atHour(18) // GAS uses script timezone; set GAS timezone to Asia/Tokyo in Project Settings
    .create();
  // Daily lottery: 19:xx (fallback — idempotency check skips if already done at 18:xx)
  ScriptApp.newTrigger("rumbleDailyLotteryTrigger_")
    .timeBased()
    .everyDays(1)
    .atHour(19)
    .create();

  // Weekly EP reward: every Friday 23:00–24:00 JST
  ScriptApp.newTrigger("rumbleWeeklyRewardTrigger_")
    .timeBased()
    .onWeekDay(ScriptApp.WeekDay.FRIDAY)
    .atHour(23)
    .create();

  // 毎日18:00〜19:00 JST に古いバトルログを削除（新規バトル前にクリーン化）
  ScriptApp.newTrigger("rumbleClearOldBattleLogsTrigger_")
    .timeBased()
    .everyDays(1)
    .atHour(18)
    .create();

  Logger.log("Rumble triggers set up successfully.");
}

/** Public wrapper — run this from the GAS editor dropdown to install time triggers. */
function setupRumbleTriggers() {
  setupRumbleTriggers_();
}

// ─── りふぁねこ チャットログ / FAQ / unknown ────────────────────────────────

function getCatSheet_(name, headers) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(name);
  if (!sheet) {
    sheet = ss.insertSheet(name);
    sheet.appendRow(headers);
  }
  return sheet;
}

// action: cat_log_create
// body: { log_id, user_id, session_id, page_path, widget_mode, user_message, assistant_message, source_type, confidence }
function catLogCreate_(body) {
  try {
    var sheet = getCatSheet_("cat_chat_logs", [
      "log_id","user_id","session_id","page_path","widget_mode",
      "user_message","assistant_message","source_type","confidence","resolved","created_at"
    ]);
    var now = new Date().toISOString();
    sheet.appendRow([
      str_(body.log_id),
      str_(body.user_id),
      str_(body.session_id),
      str_(body.page_path),
      str_(body.widget_mode) || "popup",
      str_(body.user_message),
      str_(body.assistant_message),
      str_(body.source_type) || "ai",
      body.confidence !== undefined ? Number(body.confidence) : 1,
      "false",
      now
    ]);
    return json_({ ok: true, log_id: str_(body.log_id) });
  } catch(e) {
    return json_({ ok: false, error: String(e) });
  }
}

// action: cat_log_feedback
// body: { log_id, rating, comment }
function catLogFeedback_(body) {
  try {
    var sheet = getCatSheet_("cat_feedback", [
      "feedback_id","log_id","rating","comment","created_at"
    ]);
    var now = new Date().toISOString();
    var feedbackId = "CF-" + Utilities.getUuid().replace(/-/g,"").substring(0,12);
    sheet.appendRow([feedbackId, str_(body.log_id), str_(body.rating), str_(body.comment || ""), now]);

    // bad評価は unknown にも積む
    if (str_(body.rating) === "bad" && str_(body.user_message)) {
      catUnknownUpsert_({ user_message: str_(body.user_message), page_path: str_(body.page_path || "") });
    }

    // resolved フラグ更新
    if (str_(body.rating) === "good") {
      var logSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("cat_chat_logs");
      if (logSheet) {
        var vals = logSheet.getDataRange().getValues();
        var hdr = vals[0];
        var idx = {}; hdr.forEach(function(h,i){ idx[h]=i; });
        for (var i = 1; i < vals.length; i++) {
          if (str_(vals[i][idx["log_id"]]) === str_(body.log_id)) {
            logSheet.getRange(i+1, idx["resolved"]+1).setValue("true");
            break;
          }
        }
      }
    }
    return json_({ ok: true });
  } catch(e) {
    return json_({ ok: false, error: String(e) });
  }
}

// action: cat_faq_list
// body: { category? }
function catFaqList_(body) {
  try {
    var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("cat_faq");
    if (!sheet) return json_({ ok: true, items: [] });
    var vals = sheet.getDataRange().getValues();
    if (vals.length < 2) return json_({ ok: true, items: [] });
    var hdr = vals[0];
    var idx = {}; hdr.forEach(function(h,i){ idx[h]=i; });
    var items = [];
    for (var i = 1; i < vals.length; i++) {
      var r = vals[i];
      if (str_(r[idx["enabled"]]) === "false") continue;
      if (body.category && str_(r[idx["category"]]) !== str_(body.category)) continue;
      items.push({
        faq_id:           str_(r[idx["faq_id"]]),
        category:         str_(r[idx["category"]]),
        question_pattern: str_(r[idx["question_pattern"]]),
        answer:           str_(r[idx["answer"]]),
        tags:             str_(r[idx["tags"]]),
        priority:         Number(r[idx["priority"]] || 0),
      });
    }
    items.sort(function(a,b){ return b.priority - a.priority; });
    return json_({ ok: true, items: items });
  } catch(e) {
    return json_({ ok: false, error: String(e) });
  }
}

// action: cat_unknown_upsert
// body: { user_message, page_path }
function catUnknownUpsert_(body) {
  try {
    var sheet = getCatSheet_("cat_unknown_questions", [
      "unknown_id","user_message","normalized_message","page_path","count","first_seen_at","last_seen_at","status","admin_answer"
    ]);
    var msg = str_(body.user_message).trim();
    if (!msg) return json_({ ok: false, error: "empty_message" });
    var normalized = msg.toLowerCase().replace(/[　\s]+/g," ").substring(0, 200);
    var vals = sheet.getDataRange().getValues();
    var hdr = vals[0];
    var idx = {}; hdr.forEach(function(h,i){ idx[h]=i; });
    var now = new Date().toISOString();
    for (var i = 1; i < vals.length; i++) {
      if (str_(vals[i][idx["normalized_message"]]) === normalized) {
        var count = Number(vals[i][idx["count"]] || 0) + 1;
        sheet.getRange(i+1, idx["count"]+1).setValue(count);
        sheet.getRange(i+1, idx["last_seen_at"]+1).setValue(now);
        return json_({ ok: true, unknown_id: str_(vals[i][idx["unknown_id"]]) });
      }
    }
    var uid = "UQ-" + Utilities.getUuid().replace(/-/g,"").substring(0,12);
    sheet.appendRow([uid, msg, normalized, str_(body.page_path||""), 1, now, now, "open", ""]);
    return json_({ ok: true, unknown_id: uid });
  } catch(e) {
    return json_({ ok: false, error: String(e) });
  }
}

// =====================================================
// 画像生成 BP ロック / コミット / 返却
// =====================================================

// action: bp_lock
// body: { id, amount, reason }
function imageBpLock_(body) {
  try {
    var id     = str_(body.id);
    var amount = num_(body.amount);
    var reason = str_(body.reason || "image");
    if (!id || amount <= 0) return json_({ ok: false, error: "invalid_params" });

    var ss    = SpreadsheetApp.getActiveSpreadsheet();
    var locks = ss.getSheetByName("image_bp_locks");
    if (!locks) {
      locks = ss.insertSheet("image_bp_locks");
      locks.appendRow(["lock_id","user_id","amount","reason","status","created_at"]);
    }

    var lockId = "LK-" + Utilities.getUuid().replace(/-/g,"").substring(0,16);
    var now    = new Date().toISOString();
    locks.appendRow([lockId, id, amount, reason, "locked", now]);

    return json_({ ok: true, lock_id: lockId });
  } catch(e) {
    return json_({ ok: false, error: String(e) });
  }
}

// action: bp_commit
// body: { id, lock_id }
function imageBpCommit_(body) {
  try {
    var id     = str_(body.id);
    var lockId = str_(body.lock_id);
    if (!id || !lockId) return json_({ ok: false, error: "invalid_params" });

    var ss    = SpreadsheetApp.getActiveSpreadsheet();
    var locks = ss.getSheetByName("image_bp_locks");
    if (!locks) return json_({ ok: false, error: "no_locks_sheet" });

    var data   = locks.getDataRange().getValues();
    var header = data[0];
    var lidIdx = header.indexOf("lock_id");
    var stIdx  = header.indexOf("status");
    var amtIdx = header.indexOf("amount");
    var uidIdx = header.indexOf("user_id");

    for (var i = 1; i < data.length; i++) {
      if (data[i][lidIdx] === lockId && data[i][uidIdx] === id && data[i][stIdx] === "locked") {
        locks.getRange(i + 1, stIdx + 1).setValue("committed");
        var amount = num_(data[i][amtIdx]);
        adjustImageBp_(id, -amount, "image_commit:" + lockId);
        return json_({ ok: true });
      }
    }
    return json_({ ok: false, error: "lock_not_found" });
  } catch(e) {
    return json_({ ok: false, error: String(e) });
  }
}

// action: bp_refund
// body: { id, lock_id }
function imageBpRefund_(body) {
  try {
    var id     = str_(body.id);
    var lockId = str_(body.lock_id);
    if (!id || !lockId) return json_({ ok: false, error: "invalid_params" });

    var ss    = SpreadsheetApp.getActiveSpreadsheet();
    var locks = ss.getSheetByName("image_bp_locks");
    if (!locks) return json_({ ok: false, error: "no_locks_sheet" });

    var data   = locks.getDataRange().getValues();
    var header = data[0];
    var lidIdx = header.indexOf("lock_id");
    var stIdx  = header.indexOf("status");
    var uidIdx = header.indexOf("user_id");

    for (var i = 1; i < data.length; i++) {
      if (data[i][lidIdx] === lockId && data[i][uidIdx] === id && data[i][stIdx] === "locked") {
        locks.getRange(i + 1, stIdx + 1).setValue("refunded");
        return json_({ ok: true });
      }
    }
    return json_({ ok: false, error: "lock_not_found" });
  } catch(e) {
    return json_({ ok: false, error: String(e) });
  }
}

// =====================================================
// 画像ログ・履歴
// =====================================================

// action: image_log
// body: { id, prompt, image_url, bp_used, type, meta_json }
function imageLog_(body) {
  try {
    var id       = str_(body.id);
    var prompt   = str_(body.prompt);
    var imageUrl = str_(body.image_url);
    var bpUsed   = num_(body.bp_used);
    var type     = str_(body.type || "generate");
    var metaJson = str_(body.meta_json || "{}");
    if (!id || !imageUrl) return json_({ ok: false, error: "invalid_params" });

    var ss   = SpreadsheetApp.getActiveSpreadsheet();
    var logs = ss.getSheetByName("image_logs");
    if (!logs) {
      logs = ss.insertSheet("image_logs");
      logs.appendRow(["id","user_id","prompt","image_url","bp_used","type","meta_json","created_at"]);
    }

    var uid = "IMG-" + Utilities.getUuid().replace(/-/g,"").substring(0,16);
    var now = new Date().toISOString();
    logs.appendRow([uid, id, prompt, imageUrl, bpUsed, type, metaJson, now]);

    return json_({ ok: true, id: uid });
  } catch(e) {
    return json_({ ok: false, error: String(e) });
  }
}

// action: image_history
// body: { id, limit }
function imageHistory_(body) {
  try {
    var id    = str_(body.id);
    var limit = Math.min(num_(body.limit || 30), 100);
    if (!id) return json_({ ok: false, error: "invalid_params" });

    var ss   = SpreadsheetApp.getActiveSpreadsheet();
    var logs = ss.getSheetByName("image_logs");
    if (!logs) return json_({ ok: true, items: [] });

    var data   = logs.getDataRange().getValues();
    var header = data[0];
    var uidIdx = header.indexOf("user_id");
    var items  = [];

    for (var i = 1; i < data.length; i++) {
      if (data[i][uidIdx] === id) {
        items.push({
          id:         str_(data[i][header.indexOf("id")]),
          user_id:    id,
          prompt:     str_(data[i][header.indexOf("prompt")]),
          image_url:  str_(data[i][header.indexOf("image_url")]),
          bp_used:    num_(data[i][header.indexOf("bp_used")]),
          type:       str_(data[i][header.indexOf("type")]),
          created_at: str_(data[i][header.indexOf("created_at")]),
        });
      }
    }

    items.sort(function(a, b) { return b.created_at.localeCompare(a.created_at); });
    return json_({ ok: true, items: items.slice(0, limit) });
  } catch(e) {
    return json_({ ok: false, error: String(e) });
  }
}

// 画像用 BP 増減ヘルパー（users シートの bp 列を直接操作）
function adjustImageBp_(userId, delta, note) {
  try {
    var ss    = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheetByName("users");
    if (!sheet) return;
    var data   = sheet.getDataRange().getValues();
    var header = data[0];
    var idIdx  = header.indexOf("login_id");
    var bpIdx  = header.indexOf("bp");
    if (idIdx < 0 || bpIdx < 0) return;
    for (var i = 1; i < data.length; i++) {
      if (str_(data[i][idIdx]) === userId) {
        var current = num_(data[i][bpIdx]);
        sheet.getRange(i + 1, bpIdx + 1).setValue(Math.max(0, current + delta));
        return;
      }
    }
  } catch(e) {
    // サイレント失敗
  }
}

// ============================================================
// MUSIC HISTORY（音楽生成履歴 サーバー管理）
// 追加日: 2026-04 / 既存コードへの変更なし・追記のみ
// ============================================================

function getMusicHistorySheet_() {
  var ss    = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName("music_history");
  if (!sheet) {
    sheet = ss.insertSheet("music_history");
    sheet.appendRow([
      "id", "user_id", "job_id", "title",
      "audio_url", "download_url", "lyrics",
      "created_at", "expires_at"
    ]);
  }
  return sheet;
}

// action: music_history_save
// body: { userId, jobId, title, audioUrl, downloadUrl, lyrics, createdAt, expiresAt }
function musicHistorySave_(body) {
  var userId      = String(body.userId      || "");
  var jobId       = String(body.jobId       || "");
  var title       = String(body.title       || "");
  var audioUrl    = String(body.audioUrl    || "");
  var downloadUrl = String(body.downloadUrl || "");
  var lyrics      = String(body.lyrics      || "");
  var createdAt   = String(body.createdAt   || new Date().toISOString());
  var expiresAt   = String(body.expiresAt   || "");

  if (!userId || !jobId) return json_({ ok: false, error: "userId_and_jobId_required" });

  var sheet   = getMusicHistorySheet_();
  var data    = sheet.getDataRange().getValues();
  var headers = data[0];
  var idx     = {};
  headers.forEach(function(h, i) { idx[h] = i; });

  // 同一 job_id が既にあれば上書き（冪等性）
  for (var i = 1; i < data.length; i++) {
    if (String(data[i][idx["user_id"]]) === userId &&
        String(data[i][idx["job_id"]])  === jobId) {
      var rowNum = i + 1;
      sheet.getRange(rowNum, idx["title"]        + 1).setValue(title);
      sheet.getRange(rowNum, idx["audio_url"]    + 1).setValue(audioUrl);
      sheet.getRange(rowNum, idx["download_url"] + 1).setValue(downloadUrl);
      sheet.getRange(rowNum, idx["lyrics"]       + 1).setValue(lyrics);
      sheet.getRange(rowNum, idx["expires_at"]   + 1).setValue(expiresAt);
      SpreadsheetApp.flush();
      return json_({ ok: true, action: "updated" });
    }
  }

  // 新規追加
  var id = Utilities.getUuid();
  sheet.appendRow([
    id, userId, jobId, title,
    audioUrl, downloadUrl, lyrics,
    createdAt, expiresAt
  ]);
  SpreadsheetApp.flush();
  return json_({ ok: true, action: "created" });
}

// action: music_history_list
// body: { userId, limit? }
// 返却: 最新50件（expires_at が過去のものは除外）
function musicHistoryList_(body) {
  var userId = String(body.userId || "");
  var limit  = Math.min(Number(body.limit || 50), 50);

  if (!userId) return json_({ ok: false, error: "userId_required" });

  var sheet   = getMusicHistorySheet_();
  var data    = sheet.getDataRange().getValues();
  if (data.length < 2) return json_({ ok: true, items: [] });

  var headers = data[0];
  var idx     = {};
  headers.forEach(function(h, i) { idx[h] = i; });

  var nowIso = new Date().toISOString();
  var items  = [];

  for (var i = 1; i < data.length; i++) {
    if (String(data[i][idx["user_id"]]) !== userId) continue;
    var expiresAt = String(data[i][idx["expires_at"]] || "");
    if (expiresAt && expiresAt < nowIso) continue; // 有効期限切れをスキップ
    items.push({
      jobId:       String(data[i][idx["job_id"]]),
      title:       String(data[i][idx["title"]]),
      audioUrl:    String(data[i][idx["audio_url"]]),
      downloadUrl: String(data[i][idx["download_url"]]),
      lyrics:      String(data[i][idx["lyrics"]]),
      createdAt:   String(data[i][idx["created_at"]]),
      expiresAt:   expiresAt,
    });
  }

  // created_at 降順で最新 limit 件
  items.sort(function(a, b) { return b.createdAt > a.createdAt ? 1 : -1; });
  return json_({ ok: true, items: items.slice(0, limit) });
}

// ──────────────────────────────────────────────────────────────────────
// Monitor helper functions（監視ダッシュボード用）
// ──────────────────────────────────────────────────────────────────────

function monitorSongStats_() {
  try {
    var sheet = getMusicJobSheet_();
    if (!sheet || sheet.getLastRow() < 2) {
      return {
        ok: true,
        status_counts: {
          lyrics_generating: 0, lyrics_done: 0,
          structure_generating: 0, structure_done: 0,
          audio_generating: 0, done: 0, failed: 0
        },
        avg_total_duration_sec: null
      };
    }

    var data = sheet.getDataRange().getValues();
    var headers = data[0];
    var idx = {};
    headers.forEach(function(h, i) { idx[h] = i; });

    var nowJst = new Date(Date.now() + 9 * 60 * 60 * 1000);
    var todayStr = nowJst.toISOString().slice(0, 10);

    var counts = {
      lyrics_generating: 0, lyrics_ready: 0,
      structure_generating: 0, structure_ready: 0,
      generating_audio: 0, audio_generating: 0,
      postprocessing: 0, uploading_result: 0,
      completed: 0, failed: 0, cancelled: 0
    };

    for (var i = 1; i < data.length; i++) {
      var row = data[i];
      if (!row[idx['job_id']]) continue;
      var status = String(row[idx['status']] || '');
      if (counts.hasOwnProperty(status)) {
        counts[status]++;
      }
    }

    var doneToday = 0, failedToday = 0;
    for (var j = 1; j < data.length; j++) {
      var r = data[j];
      if (!r[idx['job_id']]) continue;
      var updatedAt = String(r[idx['updated_at']] || '');
      if (updatedAt.slice(0, 10) === todayStr) {
        var st = String(r[idx['status']] || '');
        if (st === 'completed') doneToday++;
        if (st === 'failed') failedToday++;
      }
    }

    return {
      ok: true,
      status_counts: {
        lyrics_generating: counts.lyrics_generating,
        lyrics_done: counts.lyrics_ready,
        structure_generating: counts.structure_generating,
        structure_done: counts.structure_ready,
        audio_generating: counts.generating_audio + counts.audio_generating + counts.postprocessing + counts.uploading_result,
        done: doneToday,
        failed: failedToday
      },
      avg_total_duration_sec: null
    };
  } catch (e) {
    return { ok: false, error: String(e) };
  }
}


function monitorGamesStats_() {
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();

    var tapActiveUsers = 0;
    var tapTotalTaps = 0;
    var batchCallsLast5m = 0;

    var batchSheet = ss.getSheetByName('tap_batch_logs');
    if (batchSheet && batchSheet.getLastRow() > 1) {
      var bData = batchSheet.getDataRange().getValues();
      var bHeaders = bData[0];
      var bIdx = {};
      bHeaders.forEach(function(h, i) { bIdx[h] = i; });

      var nowJst5 = new Date(Date.now() + 9 * 60 * 60 * 1000);
      var todayStr5 = nowJst5.toISOString().slice(0, 10);
      var fiveMinAgo = Date.now() - 5 * 60 * 1000;
      var tapUsers = {};

      for (var i = 1; i < bData.length; i++) {
        var row = bData[i];
        var createdAt = String(row[bIdx['created_at']] || '');
        if (createdAt.slice(0, 10) !== todayStr5) continue;
        var userId = String(row[bIdx['user_id']] || '');
        tapUsers[userId] = true;
        tapTotalTaps += Number(row[bIdx['processed_tap_count']] || 0);

        var rowTime = new Date(createdAt).getTime();
        if (!isNaN(rowTime) && rowTime > fiveMinAgo) {
          batchCallsLast5m++;
        }
      }
      tapActiveUsers = Object.keys(tapUsers).length;
    }

    var rumbleParticipants = 0;
    var entrySheet = ss.getSheetByName('rumble_entry');
    if (entrySheet && entrySheet.getLastRow() > 1) {
      rumbleParticipants = entrySheet.getLastRow() - 1;
    }

    return {
      ok: true,
      tap: {
        active_users_today: tapActiveUsers,
        total_taps_today: tapTotalTaps,
        batch_calls_last_5m: batchCallsLast5m
      },
      rumble: {
        current_participants: rumbleParticipants,
        gacha_today: 0,
        enhance_today: 0,
        dismantle_today: 0
      }
    };
  } catch (e) {
    return { ok: false, error: String(e) };
  }
}


function monitorMarketStats_() {
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();

    var marketSheet = ss.getSheetByName('market');
    if (!marketSheet) {
      return {
        ok: true,
        active_items: 0,
        orders_today: 0,
        reports_today: 0,
        sell_requests_today: 0
      };
    }

    var data = marketSheet.getDataRange().getValues();
    var headers = data[0];
    var idx = {};
    headers.forEach(function(h, i) { idx[h] = i; });

    var nowJst = new Date(Date.now() + 9 * 60 * 60 * 1000);
    var todayStr = nowJst.toISOString().slice(0, 10);

    var activeItems = 0;
    var ordersToday = 0;

    for (var i = 1; i < data.length; i++) {
      var row = data[i];
      var status = String(row[idx['status']] || '');
      if (status === 'active') activeItems++;

      var updatedAt = String(row[idx['updated_at']] || row[idx['created_at']] || '');
      if (status === 'sold' && updatedAt.slice(0, 10) === todayStr) {
        ordersToday++;
      }
    }

    var sellToday = 0;
    var sellSheet = ss.getSheetByName('SellRequests');
    if (sellSheet && sellSheet.getLastRow() > 1) {
      var sData = sellSheet.getDataRange().getValues();
      var sHeaders = sData[0];
      var sIdx = {};
      sHeaders.forEach(function(h, i) { sIdx[h] = i; });
      for (var j = 1; j < sData.length; j++) {
        var createdAt = String(sData[j][sIdx['created_at']] || '');
        if (createdAt.slice(0, 10) === todayStr) sellToday++;
      }
    }

    return {
      ok: true,
      active_items: activeItems,
      orders_today: ordersToday,
      reports_today: 0,
      sell_requests_today: sellToday
    };
  } catch (e) {
    return { ok: false, error: String(e) };
  }
}


function monitorWalletStats_() {
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var boostSheet = ss.getSheetByName('music_boost');
    if (!boostSheet || boostSheet.getLastRow() < 2) {
      return {
        ok: true,
        pending_bp_claims: 0,
        music_boost_active: 0,
        music_boost_expiring_soon: 0,
        music_boost_canceled_today: 0
      };
    }

    var data = boostSheet.getDataRange().getValues();
    var headers = data[0];
    var idx = {};
    headers.forEach(function(h, i) { idx[h] = i; });

    var nowMs = Date.now();
    var nowJst = new Date(nowMs + 9 * 60 * 60 * 1000);
    var todayStr = nowJst.toISOString().slice(0, 10);
    var threeDaysMs = 3 * 24 * 60 * 60 * 1000;

    var active = 0, expiringSoon = 0, canceledToday = 0;

    for (var i = 1; i < data.length; i++) {
      var row = data[i];
      var status = String(row[idx['status']] || '');

      if (status === 'active') {
        active++;
        var expiresAt = row[idx['expires_at']];
        if (expiresAt) {
          var expMs = new Date(expiresAt).getTime();
          if (!isNaN(expMs) && expMs - nowMs < threeDaysMs && expMs > nowMs) {
            expiringSoon++;
          }
        }
      }

      if (status === 'canceled') {
        var canceledAt = String(row[idx['canceled_at']] || row[idx['updated_at']] || '');
        if (canceledAt.slice(0, 10) === todayStr) canceledToday++;
      }
    }

    var pendingBp = 0;
    var pendingSheet = ss.getSheetByName('PendingBP');
    if (pendingSheet && pendingSheet.getLastRow() > 1) {
      var pData = pendingSheet.getDataRange().getValues();
      var pHeaders = pData[0];
      var pIdx = {};
      pHeaders.forEach(function(h, i) { pIdx[h] = i; });
      for (var j = 1; j < pData.length; j++) {
        var claimed = pData[j][pIdx['claimed_at']];
        if (!claimed) pendingBp++;
      }
    }

    return {
      ok: true,
      pending_bp_claims: pendingBp,
      music_boost_active: active,
      music_boost_expiring_soon: expiringSoon,
      music_boost_canceled_today: canceledToday
    };
  } catch (e) {
    return { ok: false, error: String(e) };
  }
}


// ──────────────────────────────────────────────────────────────────────
// Monitor helpers — Boost & Rumble（監視ダッシュボード用）
// ──────────────────────────────────────────────────────────────────────

function monitorBoostSubscribers_() {
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var boostSheet = getMusicBoostSheet_();
    if (!boostSheet || boostSheet.getLastRow() < 2) {
      return { ok: true, subscribers: [], total: 0 };
    }

    var data = boostSheet.getDataRange().getValues();
    var headers = data[0];
    var idx = {};
    headers.forEach(function(h, i) { idx[h] = i; });

    var displayNameMap = {};
    var appliesSheet = ss.getSheetByName('applies');
    if (appliesSheet && appliesSheet.getLastRow() > 1) {
      var aData = appliesSheet.getDataRange().getValues();
      var aHeaders = aData[0];
      var aIdx = {};
      aHeaders.forEach(function(h, i) { aIdx[h] = i; });
      for (var ai = 1; ai < aData.length; ai++) {
        var uid = String(aData[ai][aIdx['login_id']] || '');
        if (!uid) continue;
        displayNameMap[uid] = String(aData[ai][aIdx['rumble_display_name']] || '') || uid;
      }
    }

    var subscribers = [];
    for (var i = 1; i < data.length; i++) {
      var row = data[i];
      if (String(row[idx['status']] || '') !== 'active') continue;
      var userId = String(row[idx['user_id']] || '');
      subscribers.push({
        user_id:      userId,
        display_name: displayNameMap[userId] || userId,
        plan_id:      String(row[idx['plan_id']] || ''),
        percent:      Number(row[idx['percent']] || 0),
        slots_used:   Number(row[idx['slots_used']] || 0),
        started_at:   String(row[idx['started_at']] || ''),
        expires_at:   String(row[idx['expires_at']] || ''),
      });
    }

    subscribers.sort(function(a, b) { return b.percent - a.percent; });
    return { ok: true, subscribers: subscribers, total: subscribers.length };
  } catch (e) {
    return { ok: false, error: String(e) };
  }
}


function monitorRumbleToday_() {
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var entrySheet = ss.getSheetByName('rumble_entry');
    var nowJst = new Date(Date.now() + 9 * 60 * 60 * 1000);
    var todayStr = nowJst.toISOString().slice(0, 10);

    if (!entrySheet || entrySheet.getLastRow() < 2) {
      return { ok: true, date: todayStr, participants: [], total: 0 };
    }

    var data = entrySheet.getDataRange().getValues();
    var headers = data[0];
    var idx = {};
    headers.forEach(function(h, i) { idx[h] = i; });

    var displayNameMap = {};
    var appliesSheet = ss.getSheetByName('applies');
    if (appliesSheet && appliesSheet.getLastRow() > 1) {
      var aData = appliesSheet.getDataRange().getValues();
      var aHeaders = aData[0];
      var aIdx = {};
      aHeaders.forEach(function(h, i) { aIdx[h] = i; });
      for (var ai = 1; ai < aData.length; ai++) {
        var uid = String(aData[ai][aIdx['login_id']] || '');
        if (uid) displayNameMap[uid] = String(aData[ai][aIdx['rumble_display_name']] || '') || uid;
      }
    }

    var participants = [];
    for (var i = 1; i < data.length; i++) {
      var row = data[i];
      var dateStr = rumbleDateStr_(row[idx['date']]);
      if (dateStr !== todayStr) continue;
      var userId = String(row[idx['user_id']] || '');
      participants.push({
        user_id:      userId,
        display_name: displayNameMap[userId] || userId,
        score:        Number(row[idx['score']] || 0),
        rp:           Number(row[idx['rp']] || 0),
        created_at:   String(row[idx['created_at']] || ''),
      });
    }

    participants.sort(function(a, b) { return b.score - a.score; });
    participants.forEach(function(p, i) { p.rank = i + 1; });
    return { ok: true, date: todayStr, participants: participants, total: participants.length };
  } catch (e) {
    return { ok: false, error: String(e) };
  }
}


function monitorRumbleDaily_() {
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var resultSheet = ss.getSheetByName('rumble_daily_result');
    var nowJst = new Date(Date.now() + 9 * 60 * 60 * 1000);
    var todayStr = nowJst.toISOString().slice(0, 10);

    if (!resultSheet || resultSheet.getLastRow() < 2) {
      return { ok: true, status: 'no_data', date: todayStr, winners: [], participant_count: 0 };
    }

    var data = resultSheet.getDataRange().getValues();
    var headers = data[0];
    var idx = {};
    headers.forEach(function(h, i) { idx[h] = i; });

    var todayRows = [];
    var latestDate = '';
    var latestRows = [];

    for (var i = 1; i < data.length; i++) {
      var d = rumbleDateStr_(data[i][idx['date']]);
      if (d === todayStr) {
        todayRows.push(data[i]);
      }
      if (d > latestDate) {
        latestDate = d;
        latestRows = [data[i]];
      } else if (d === latestDate) {
        latestRows.push(data[i]);
      }
    }

    var targetRows = todayRows.length > 0 ? todayRows : latestRows;
    var targetDate = todayRows.length > 0 ? todayStr : latestDate;
    var isToday = todayRows.length > 0;

    if (targetRows.length === 0) {
      return { ok: true, status: 'no_data', date: todayStr, winners: [], participant_count: 0 };
    }

    var participantCount = Number(targetRows[0][idx['participant_count']] || 0);
    var allDistributed = targetRows.every(function(row) { return !!row[idx['distributed']]; });

    if (!allDistributed && isToday) {
      return {
        ok: true, status: 'pending', date: targetDate, is_today: true,
        participant_count: participantCount, winners: []
      };
    }

    var winners = targetRows.map(function(row) {
      return {
        rank:         Number(row[idx['rank']] || 0),
        user_id:      String(row[idx['user_id']] || ''),
        display_name: String(row[idx['display_name']] || ''),
        bp_amount:    Number(row[idx['bp_amount']] || 0),
        distributed:  !!row[idx['distributed']],
      };
    });
    winners.sort(function(a, b) { return a.rank - b.rank; });

    return {
      ok: true, status: 'ready', date: targetDate, is_today: isToday,
      participant_count: participantCount, winners: winners
    };
  } catch (e) {
    return { ok: false, error: String(e) };
  }
}


function monitorRumbleWeekly_() {
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var weekId = getRumbleWeekId_();
    var weekSheet = ss.getSheetByName('rumble_week');

    if (!weekSheet || weekSheet.getLastRow() < 2) {
      return { ok: true, week_id: weekId, participant_count: 0, ranking: [], ep_table: rumbleEpTable_(0) };
    }

    var data = weekSheet.getDataRange().getValues();
    var headers = data[0];
    var idx = {};
    headers.forEach(function(h, i) { idx[h] = i; });

    var displayNameMap = {};
    var appliesSheet = ss.getSheetByName('applies');
    if (appliesSheet && appliesSheet.getLastRow() > 1) {
      var aData = appliesSheet.getDataRange().getValues();
      var aHeaders = aData[0];
      var aIdx = {};
      aHeaders.forEach(function(h, i) { aIdx[h] = i; });
      for (var ai = 1; ai < aData.length; ai++) {
        var uid = String(aData[ai][aIdx['login_id']] || '');
        if (uid) displayNameMap[uid] = String(aData[ai][aIdx['rumble_display_name']] || '') || uid;
      }
    }

    var ranking = [];
    for (var i = 1; i < data.length; i++) {
      var row = data[i];
      if (String(row[idx['week_id']] || '') !== weekId) continue;
      var userId = String(row[idx['user_id']] || '');
      ranking.push({
        user_id:    userId,
        display_name: displayNameMap[userId] || userId,
        total_rp:   Number(row[idx['total_rp']] || 0),
        updated_at: String(row[idx['updated_at']] || ''),
      });
    }

    ranking.sort(function(a, b) { return b.total_rp - a.total_rp; });
    var total = ranking.length;
    ranking.forEach(function(r, i) {
      r.rank = i + 1;
      r.ep_reward = rumbleEpForRank_(i + 1, total);
    });

    return {
      ok: true, week_id: weekId, participant_count: total,
      ranking: ranking.slice(0, 100), ep_table: rumbleEpTable_(total)
    };
  } catch (e) {
    return { ok: false, error: String(e) };
  }
}


function getRumbleWeekId_() {
  var nowJst = new Date(Date.now() + 9 * 60 * 60 * 1000);
  var day = nowJst.getDay();
  var monday = new Date(nowJst);
  monday.setDate(nowJst.getDate() - (day === 0 ? 6 : day - 1));
  monday.setHours(0, 0, 0, 0);
  var startOfYear = new Date(monday.getFullYear(), 0, 1);
  var weekNum = Math.ceil(((monday - startOfYear) / 86400000 + 1) / 7);
  return monday.getFullYear() + '-W' + String(weekNum).padStart(2, '0');
}


function rumbleEpTable_(total) {
  if (total <= 2) {
    return [{ rank: '1位', ep: 400 }, { rank: '2位', ep: 300 }];
  } else if (total <= 4) {
    return [{ rank: '1位', ep: 350 }, { rank: '2位', ep: 230 }, { rank: '3位', ep: 120 }];
  } else if (total <= 9) {
    return [{ rank: '1位', ep: 300 }, { rank: '2位', ep: 200 }, { rank: '3位', ep: 120 }, { rank: '4〜5位', ep: 40 }];
  } else {
    return [{ rank: '1位', ep: 280 }, { rank: '2位', ep: 190 }, { rank: '3位', ep: 120 }, { rank: '4〜5位', ep: 45 }, { rank: '6〜10位', ep: 4 }];
  }
}


function rumbleEpForRank_(rank, total) {
  if (total <= 2) {
    return rank === 1 ? 400 : rank === 2 ? 300 : 0;
  } else if (total <= 4) {
    return rank === 1 ? 350 : rank === 2 ? 230 : rank === 3 ? 120 : 0;
  } else if (total <= 9) {
    return rank === 1 ? 300 : rank === 2 ? 200 : rank === 3 ? 120 : rank <= 5 ? 40 : 0;
  } else {
    return rank === 1 ? 280 : rank === 2 ? 190 : rank === 3 ? 120 : rank <= 5 ? 45 : rank <= 10 ? 4 : 0;
  }
}


function monitorRumbleSpectator_() {
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var entrySheet = ss.getSheetByName('rumble_entry');
    var nowJst = new Date(Date.now() + 9 * 60 * 60 * 1000);
    var todayStr = nowJst.toISOString().slice(0, 10);

    // Scan rumble_entry for today
    var firstUserId = null;
    var todayCount = 0;
    var lastEntryDate = '';
    if (entrySheet && entrySheet.getLastRow() >= 2) {
      var data = entrySheet.getDataRange().getValues();
      var headers = data[0];
      var idx = {};
      headers.forEach(function(h, i) { idx[h] = i; });
      for (var i = 1; i < data.length; i++) {
        var d = rumbleDateStr_(data[i][idx['date']]);
        if (d === todayStr) {
          if (!firstUserId) firstUserId = String(data[i][idx['user_id']] || '');
          todayCount++;
        }
        if (d > lastEntryDate) lastEntryDate = d;
      }
    }

    if (firstUserId) {
      // Today has entries — generate (or read from cache) via existing spectator logic
      var raw = rumbleSpectator_({ userId: firstUserId });
      var spectatorResult = JSON.parse(raw.getContent());
      return {
        ok:      true,
        status:  'ready',
        date:    todayStr,
        total:   todayCount,
        last_entry_date: todayStr,
        events:  spectatorResult.events  || [],
        players: spectatorResult.players || [],
      };
    }

    // No entries today — fall back to most recent cached battle log
    var cached = getLatestBattleLogCache_();
    if (cached && cached.events && cached.events.length > 0) {
      return {
        ok:      true,
        status:  'ready',
        date:    cached.date,
        total:   cached.total,
        last_entry_date: cached.date,
        events:  cached.events,
        players: cached.players,
      };
    }

    // Nothing available
    return {
      ok: true,
      status: 'no_entries',
      date: todayStr,
      total: 0,
      last_entry_date: lastEntryDate || null,
      events: [],
      players: [],
    };
  } catch (e) {
    return { ok: false, error: String(e), status: 'error' };
  }
}

// ============================================================
// RUMBLE 自動エントリー（管理者用タイムトリガー）
// 使い方:
//   1. GASスクリプトプロパティに RUMBLE_AUTO_USER_IDS = "your_login_id" を設定
//   2. createRumbleAutoEntryTrigger_() を一度だけ手動実行 → 毎日JST 6:00に自動エントリー
// ============================================================

function rumbleAutoEntry_() {
  var prop = PropertiesService.getScriptProperties().getProperty('RUMBLE_AUTO_USER_IDS') || '';
  var userIds = prop.split(',').map(function(s) { return s.trim(); }).filter(function(s) { return s !== ''; });
  if (userIds.length === 0) {
    Logger.log('[rumbleAutoEntry] RUMBLE_AUTO_USER_IDS が未設定です');
    return;
  }
  userIds.forEach(function(userId) {
    var result = rumbleEntry_({ userId: userId });
    Logger.log('[rumbleAutoEntry] userId=' + userId + ' result=' + JSON.stringify(result));
  });
}

function createRumbleAutoEntryTrigger() {
  // 既存の同名トリガーを削除してから再登録（重複防止）
  ScriptApp.getProjectTriggers().forEach(function(t) {
    if (t.getHandlerFunction() === 'rumbleAutoEntry_') {
      ScriptApp.deleteTrigger(t);
    }
  });
  ScriptApp.newTrigger('rumbleAutoEntry_')
    .timeBased()
    .everyDays(1)
    .atHour(6) // JST 6:00（GASはプロジェクトタイムゾーン基準）
    .create();
  Logger.log('[createRumbleAutoEntryTrigger] 毎日6時のトリガーを登録しました');
}

// ============================================================
// 全シート一括初期化（新規GASセットアップ時に手動実行）
// ============================================================
function initAllSheets() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();

  function ensure(name, headers) {
    let s = ss.getSheetByName(name);
    if (!s) {
      s = ss.insertSheet(name);
      s.appendRow(headers);
      Logger.log("作成: " + name);
    } else {
      Logger.log("既存: " + name);
    }
  }

  // applies（複雑なので既存関数で）
  getOrCreateSheet_();
  Logger.log("applies: 初期化済み");

  ensure("wallet_ledger", ["ts","kind","login_id","email","amount","memo"]);
  ensure("ref_tree", ["L1","L1_direct_count","L2","L2_direct_count","L3","L3_status","L3_email","L3_created_at","L1_share_pct","L1_bonus_total","L2_share_pct","L2_bonus_total"]);
  ensure("ref_events", ["ts","new_login_id","new_email","used_ref_code","ref1_login_id","ref2_login_id","ref3_login_id","note"]);
  ensure("staking", ["stake_id","login_id","staked_bp","rate","started_at","expires_at","status","claimed_at","interest_bp","total_bp"]);
  ensure("gacha_ticker", ["id","masked_id","prize_bp","created_at"]);
  ensure("cat_chat_logs", ["log_id","user_id","session_id","page_path","widget_mode","user_message","assistant_message","source_type","confidence","resolved","created_at"]);
  ensure("cat_feedback", ["feedback_id","log_id","rating","comment","created_at"]);
  ensure("cat_unknown_questions", ["unknown_id","user_message","normalized_message","page_path","count","first_seen_at","last_seen_at","status","admin_answer"]);
  ensure("cat_faq", ["faq_id","question_pattern","answer","active","created_at","updated_at"]);
  ensure("market_items", ["item_id","seller_id","seller_name","title","desc","item_type","asset_count","currency","price","fee_rate","delivery_mode","delivery_ref","stock_total","stock_sold","stock_reserved","status","report_count","created_at","updated_at"]);
  ensure("market_orders", ["order_id","item_id","buyer_id","seller_id","currency","price","fee_amount","seller_net","status","reserved_until","paid_at","delivered_at","confirmed_at","refunded_at","note","created_at","updated_at"]);
  ensure("market_escrow", ["escrow_id","order_id","currency","hold_amount","state","created_at","updated_at"]);
  ensure("market_reports", ["report_id","item_id","reporter_id","reason","message","created_at"]);
  ensure("market_daily_limits", ["user_id","date_jst","listed_count","updated_at"]);
  ensure("gift_transactions", ["id","from_user","to_user","amount","created_at","expiry_date","status","note","flagged_reason"]);
  ensure("gift_usage_logs", ["id","user_id","feature_type","feature_ref","amount","used_at","source_expiry_date"]);
  ensure("radio_songs", ["song_id","title","artist","service_links","thumbnail_url","active","created_at"]);
  ensure("radio_missions", ["mission_id","login_id","song_id","started_at","submitted_at","status","ep_granted","screenshot_note"]);
  ensure("system_settings", ["key","value"]);

  Logger.log("=== 初期化完了 ===");
}

// ============================================================
// appliesシートの全カラムを本家と同じに揃える（手動実行）
// ============================================================
function ensureAllAppliesColumns() {
  const sheet = getOrCreateSheet_();
  const lastCol = sheet.getLastColumn();
  const header = lastCol > 0 ? sheet.getRange(1, 1, 1, lastCol).getValues()[0] : [];

  const ALL_COLUMNS = [
    "created_at","plan","email","name","name_kana","ref_name","ref_id","apply_id","region",
    "status","code","code_expires_at","code_used_at","expected_paid","payment_status",
    "paid_at","order_id","invoice_id","actually_paid","discord_id","age_band","prefecture",
    "city","job","login_id","pw_hash","pw_updated_at","reset_token","reset_expires",
    "reset_used_at","reset_sent_at","bp_balance","ep_balance","my_ref_code","ref_code",
    "referrer_login_id","referrer_2_login_id","referrer_3_login_id","ref_path","bp","ep",
    "pay_amount","pay_currency","price_amount","price_currency","auto_approved_at",
    "auto_approve_reason","ref_share_pct","ref_bonus_granted_at","ref_bonus_amount",
    "bp_granted_at","bp_grant_plan","bp_grant_amount","ep_grant_amount","mail_error",
    "subscription_plan","subscription_status","subscription_started_at","subscription_period_end",
    "bp_cap","bp_last_reset_at","job_priority_score","music_priority_level","last_login_at",
    "login_streak","daily_bp_earned","daily_ep_earned","daily_reset_date","total_login_count",
    "mission_login_date","mission_fortune_date","mission_music_date","mission_bonus_date",
    "upgrade_shard","gacha_count","gacha_streak","gacha_fragments","daily_gacha_used",
    "rumble_display_name","gift_ep_balance","gift_ep_expiry_map","referrer_4_login_id",
    "referrer_5_login_id","affiliate_granted_at","music_boost_artist","music_boost_album",
    "entry_source","music_boost_tracks_json","approved_at",
  ];

  ensureCols_(sheet, header, ALL_COLUMNS);
  Logger.log("appliesカラム整備完了: " + sheet.getLastColumn() + "列");
}

