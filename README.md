# Record

Claude Code で作ったプロジェクト・リポジトリ・Artifact ごとに、**目的** と **作業内容** を記録しておくサイトです。

- サイト: https://lumiere2110.github.io/Record/
- 記録データ: [`data/records.json`](data/records.json)

## 見られるもの

- **一覧**: 作品ごとのカード（種類・カテゴリ・状態・目的・最後の作業）。クリックで詳細と作業記録の全履歴
- **作業タイムライン**: すべての作品の作業を日付順に表示
- 検索、種類（リポジトリ / Artifact / ローカル）、カテゴリで絞り込み

## 記録の追加のしかた

`data/records.json` の `items` を編集して push するとサイトに反映されます。
Claude Code のどのセッションからでも「Record に今日の作業を追記して」と頼めば更新できます。

### 新しい作品を足す

```json
{
  "id": "my-app",
  "name": "表示名",
  "type": "repo",
  "category": "学習・クイズ",
  "status": "active",
  "purpose": "何のために作ったか",
  "tags": ["HTML"],
  "created": "2026-11-06",
  "links": {
    "repo": "https://github.com/Lumiere2110/my-app",
    "site": "https://lumiere2110.github.io/my-app/",
    "artifact": "https://claude.ai/artifact/...",
    "path": "Desktop\\..."
  },
  "log": [
    { "date": "2026-11-06", "summary": "やったこと", "source": "Claude Code" }
  ]
}
```

| 項目 | 内容 |
|---|---|
| `id` | 英数字の一意な名前（URL の `#id` で直接開ける） |
| `type` | `repo`（リポジトリ）/ `artifact` / `local`（PC 内だけのもの） |
| `status` | `active`（作業中）/ `done`（完成）/ `paused`（休止） |
| `links` | 使うものだけ書けばよい |
| `log` | 作業記録。`source` は `Claude Code` / `GitHub` / `Artifact` など |

### 既存の作品に作業を足す

その作品の `log` に1行追加し、ファイル先頭の `updated` を今日の日付にします。

## ローカルで見る

`fetch` でデータを読むので、ファイルをダブルクリックではなく簡易サーバーで開きます。

```bash
python -m http.server 8000
```

その後 http://localhost:8000 を開きます。
