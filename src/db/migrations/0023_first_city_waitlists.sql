-- Round 12 (city chooser): Vienna gets its waitlist with one goal (15 verified businesses), like
-- Hamburg in 0017. Vienna already exists, and the seed sets launch values only on new cities.
-- The first cities of Canada, the US, Australia, the UK and the Netherlands come from the seed
-- (seed/locations/first-cities.ts) with their waitlists.
UPDATE locations SET launch_status = 'waitlist', business_goal = 15 WHERE kind = 'city' AND slug = 'wien' AND launch_status = 'later';
