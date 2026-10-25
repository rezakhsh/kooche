// A rental in Vienna posted with a German number: the listing says so next to the seller, and the
// rental safety note leads with it ("the landlord is abroad" is the classic deposit scam).
document.write('<script src="listing.js"><\/script>');
setTimeout(() => {
  document.querySelectorAll('section .flex.flex-wrap.gap-1\\.5').forEach((el) => el.insertAdjacentHTML('beforeend', `<span class="flex items-center gap-1 rounded-full bg-saffron-50 px-2.5 text-xs font-bold leading-7 text-saffron-800">${flag('de', 'h-3 w-4')}شمارهٔ آلمان</span>`));
  document.querySelectorAll('section.bg-saffron-50 ul').forEach((ul) => ul.insertAdjacentHTML('afterbegin', '<li><b>آگهی‌دهنده با شمارهٔ کشور دیگری ثبت‌نام کرده است.</b> پیش از دیدن خانه و امضای قرارداد، هیچ پولی نفرستید.</li>'));
  const swap = [['برلین', 'وین'], ['ودینگ', 'لئوپولدشتات'], ['13351 Berlin', '1020 Wien'], ['Leopoldplatz', 'Praterstern'], ['نویکلن', 'اوتاکرینگ'], ['فریدریش‌هاین', 'ماریاهیلف'], ['Hermannplatz', 'Westbahnhof']];
  const walk = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  for (let n; (n = walk.nextNode());) for (const [a, b] of swap) n.nodeValue = n.nodeValue.split(a).join(b);
}, 50);
