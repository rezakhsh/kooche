-- Check B (Nov 1, 2026): a business invitation's link holds a secret token, and the visitor numbers
-- stored it as its own page (src/modules/stats/visits.ts, pageGroup). Those rows become one
-- «دعوت به کسب‌وکار» row per day, and the token rows go.
INSERT INTO visit_stats (day, dimension, key, views, visitors)
SELECT day, 'page', 'invite', sum(views), 0 FROM visit_stats
WHERE dimension = 'page' AND key LIKE '/business/invite/%'
GROUP BY day
ON CONFLICT (day, dimension, key) DO UPDATE SET views = visit_stats.views + EXCLUDED.views;--> statement-breakpoint
DELETE FROM visit_stats WHERE dimension = 'page' AND key LIKE '/business/invite/%';
