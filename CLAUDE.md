# Record — Claude 向けメモ

- 記録はすべて `data/records.json`。サイト本体（index.html / js / css）は記録の追加では触らない。
- 作業を記録するときは、該当する item の `log` に `{ "date": "YYYY-MM-DD", "summary": "...", "source": "Claude Code" }` を足し、先頭の `updated` を今日にする。新しい作品なら README の形式で item を追加する。
- summary は日本語で、何をしたか・何が変わったかを1〜2文で。
- 非公開リポジトリは `"private": true` を付け、`links.repo` は書かない（このサイトは公開）。
- 編集後は JSON として正しいか確認してから commit・push する。
