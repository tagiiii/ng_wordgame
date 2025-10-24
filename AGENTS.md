# Repository Guidelines

## プロジェクト構成とモジュール配置
Angularアプリ本体は `src/` に置きます。機能単位のモジュールは `src/app/features`、共通UIは `src/app/components`、横断的なロジックは `src/app/services` に配置してください。ルーティングは `src/app/app-routing.module.ts` で一元管理します。NgRxの状態管理コードは `src/app/state` にまとめ、グローバルスタイルは `src/styles.scss`、静的アセットは `src/assets/`、環境設定は `src/environments/` を利用します。実験用コードは `sandbox/` に置き、リリース前に削除します。

## ビルド・テスト・開発コマンド
初回セットアップは `npm install`。開発サーバーは `npm run start` で `http://localhost:4200` に起動します。最適化ビルドは `npm run build` で `dist/` に生成されます。単体テストは Jasmine + Karma を使う `npm run test`、E2E テストは Cypress の `npm run e2e`。PR前には `npm run lint` でスタイル違反を解消してください。

## コーディングスタイルと命名規約
Angular CLI の既定スタイルを踏襲し、TypeScript/HTML/SCSS は2スペースインデントとシングルクォートを基本とします。コンポーネント・ディレクティブ・パイプはパスカルケース（例: `WordGridComponent`）、サービスやガードはcamelCase + 接尾辞（例: `timer.service.ts`）。可能な限り OnPush 変更検知、型付きリアクティブフォーム、`async` パイプを利用し、`npm run lint -- --fix` で自動整形します。生成物 `dist/` はコミットしません。

## テスト指針
実装ファイルと同階層に `*.spec.ts` を配置し、TestBed を用いた決定的なテストを書きます。HTTP 通信は `HttpTestingController` でモックし、分岐カバレッジ80%以上を目標にします。各機能モジュールごとに統合レベルのテストを1件以上用意し、`npm run test -- --watch=false --code-coverage` でカバレッジを確認してください。E2E が失敗した場合はスクリーンショットやログをPRに添付します。

## コミットおよびPR運用
コミットメッセージは Angular の Conventional Commits（例: `feat: add timed round rules`、`fix(timer): avoid negative countdown`）を採用し、1コミットは可能な範囲で200行以内に保ちます。PRでは要約、テスト結果、関連Issue ID、UI変更時のBefore/After画像を記載します。CI成功とレビューア承認を待ってからマージしてください。

## 設定とセキュリティの注意
APIエンドポイントや秘匿情報は環境ファイルにのみ記述し、実鍵はコミットしないでください。外部サービスの設定手順は `docs/integrations.md` に整理します。単語投稿やタイマーの入力値はサービス層とUI層の両方で検証し、不正な送信やタイミングの悪用を防ぎます。
