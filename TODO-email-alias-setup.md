# メール送信アドレス変更 TODO

各プロジェクト（aisalon / LIFAIOV / Loofity）のパスワードリセットメール等を
個人メールではなく専用Gmailから送るようにする。

---

## Step 1: 専用Gmailアカウントを3つ作成

- [ ] `noreply.aisalon@gmail.com` を作成
- [ ] `noreply.lifaiov@gmail.com` を作成
- [ ] `noreply.loofity@gmail.com` を作成

---

## Step 2: 現在のGoogleアカウントにエイリアス登録

Gmail設定 → 「アカウントとインポート」→「他のメールアドレスでメールを送信」→「メールアドレスを追加」

- [ ] `noreply.aisalon@gmail.com` を追加・認証
- [ ] `noreply.lifaiov@gmail.com` を追加・認証
- [ ] `noreply.loofity@gmail.com` を追加・認証

---

## Step 3: 各GASスクリプトを修正

`MailApp.sendEmail()` に `from` パラメータを追加する。

```javascript
// 変更前
MailApp.sendEmail(recipient, subject, body);

// 変更後
MailApp.sendEmail(recipient, subject, body, {
  from: 'noreply.xxxxx@gmail.com'  // プロジェクトごとに変える
});
```

- [ ] aisalon の GAS を修正
- [ ] LIFAIOV の GAS を修正
- [ ] Loofity の GAS を修正

---

## メモ

- GASの修正はClaudeに各GASのコードを貼れば対応してもらえる
- エイリアス認証メールは専用Gmailアカウント側に届く
