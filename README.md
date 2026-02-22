# 3レーン障害物回避ゲーム（スマホ向け）

依存なしの `HTML + CSS + JavaScript (ES Modules)` で動く、スマホ向けの3レーン障害物回避ゲームです。  
描画は `Canvas`、タイトル/リザルト UI は `DOM` で構成しています。

## 特徴
- 3レーンのタップ移動操作
- ライフ制（3ライフ）
- スコアに応じた段階的な難易度上昇
- 被弾後 `500ms` の無敵時間
- 最高スコアの `localStorage` 保存
- 縦持ち向けUI（横向き時は案内オーバーレイ表示）
- 画像素材なし（図形ベース）

## 遊び方
- タイトル画面の `ゲームスタート` を押す
- 画面内のタップ位置に応じて自機を3レーン間で移動する
- 障害物を避け続ける
- ライフが `0` になるとリザルト画面へ遷移
- リザルト画面のボタンは `タイトルへ` のみ

## ルール
- 同一レーンで自機と障害物が重なると被弾
- 被弾時: ライフ `-1`、該当障害物は消去（スコア加算なし）
- 被弾後 `500ms` は無敵（連続被弾防止）
- 障害物が画面下へ抜けたときに `スコア +1`
- スコアは「回避数」ベース

## 難易度ステージ

| Stage | スコア範囲 | 速度 | 生成間隔 | 同時2レーン生成確率 |
| --- | --- | --- | --- | --- |
| 1 | 0-14 | 420 px/s | 900ms | 0% |
| 2 | 15-34 | 520 px/s | 760ms | 10% |
| 3 | 35-59 | 630 px/s | 620ms | 20% |
| 4 | 60+ | 760 px/s | 500ms | 30% |

### 生成ルール
- 1回の生成で障害物は `1個` または `2個`
- 同時3レーン生成はしない（常に1レーン以上空く）
- 直前パターンと完全一致し続けにくいように調整

## 画面構成
- タイトル画面
- インゲーム画面（Canvas）
- リザルト画面
- 横向き時の「縦持ちでプレイしてください」オーバーレイ

## 動作環境
- スマホブラウザ想定（iPhone Safari / Android Chrome など）
- PCブラウザでも動作確認は可能（見た目はスマホ向け）
- Node.js 不要

## ローカルで動かす

最も簡単なのは `index.html` をブラウザで開く方法です。

- `index.html` を直接開く

または簡易サーバーを使う場合（任意）:
- VS Code の Live Server
- `python -m http.server`（Python が入っている場合）

## GitHub Pages で公開する

このプロジェクトは静的ファイルのみなので、そのまま `GitHub Pages` に公開できます。

1. GitHubで新しいリポジトリを作成
2. このフォルダの内容を push（`index.html` がルートにある状態）
3. リポジトリの `Settings` → `Pages`
4. `Source` を `Deploy from a branch` に設定
5. `Branch` を `main`、フォルダを `/(root)` に設定して保存
6. 表示された URL にアクセス

### push 例
```powershell
git init
git add .
git commit -m "Add lane dodge mini game"
git branch -M main
git remote add origin https://github.com/<user>/<repo>.git
git push -u origin main
```

## 保存データ
- `localStorage` キー: `miniGame.laneDodge.highScore`
- `localStorage` が使えない環境でもゲーム本体は動作（最高スコア保存のみスキップ）

## ファイル構成
```text
.
├─ index.html
├─ styles.css
├─ game-plan.md
└─ src/
   ├─ config.js    # 定数・難易度テーブル
   ├─ storage.js   # 最高スコア保存/読込
   ├─ game.js      # 状態管理・更新・衝突・スコア処理
   ├─ render.js    # Canvas描画 / DOM表示更新
   └─ main.js      # 初期化・イベント接続・画面遷移・ゲームループ
```

## 実装メモ
- 仮想座標は `360x640`（Canvas内部サイズ）
- `requestAnimationFrame` + `deltaTime` ベース更新
- `pointerdown` でレーン判定
- `visibilitychange` 時にタイムスタンプをリセットして復帰直後の大ジャンプを抑制
https://futaba-ario.github.io/mini_game/
