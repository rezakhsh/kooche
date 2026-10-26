# Sets a Peydoo bot's public profile through the Bot API: name, descriptions, commands, photo.
# Usage: python3 profile.py <secrets file> <staging|production> <avatar.jpg>. Never prints the token.
import json, sys, uuid, urllib.request
secrets, which, avatar = sys.argv[1:4]
env = dict(l.split('=', 1) for l in open(secrets).read().splitlines() if '=' in l and not l.startswith('#'))
tok = env['TELEGRAM_BOT_TOKEN']
NAME = {'staging': 'پیدو · آزمایشی', 'production': 'پیدو | Peydoo'}[which]
SHORT = 'ربات رسمی پیدو، نیازمندی‌های ایرانیان خارج از کشور. تأیید شماره، یک بار و رایگان. peydoo.com'
DESC = (
    'سلام! این ربات رسمی پیدو است، نیازمندی‌های ایرانیان خارج از کشور.\n\n'
    'با این ربات شماره‌تان را یک بار تأیید می‌کنید تا بتوانید آگهی بگذارید و پیام بدهید. رایگان است و پیامکی لازم نیست.\n\n'
    '• شماره‌تان به هیچ‌کس نشان داده نمی‌شود.\n'
    '• پیدو هرگز از شما رمز، کد یا پول نمی‌خواهد.\n\n'
    'برای شروع، در سایت پیدو به «تأیید شماره تلفن» بروید و دکمهٔ تلگرام را بزنید.'
)
if which == 'staging':
    DESC = 'این ربات آزمایشی پیدو است، فقط برای staging.peydoo.com.\n\n' + DESC
def call(method, data=None, files=None):
    url = f'https://api.telegram.org/bot{tok}/{method}'
    if files:
        b = uuid.uuid4().hex; body = b''
        for k, v in (data or {}).items():
            body += f'--{b}\r\nContent-Disposition: form-data; name="{k}"\r\n\r\n{v}\r\n'.encode()
        for k, (fn, content) in files.items():
            body += f'--{b}\r\nContent-Disposition: form-data; name="{k}"; filename="{fn}"\r\nContent-Type: image/jpeg\r\n\r\n'.encode() + content + b'\r\n'
        body += f'--{b}--\r\n'.encode()
        req = urllib.request.Request(url, data=body, headers={'Content-Type': f'multipart/form-data; boundary={b}'})
    else:
        req = urllib.request.Request(url, data=json.dumps(data or {}).encode(), headers={'Content-Type': 'application/json'})
    try: r = json.load(urllib.request.urlopen(req, timeout=30))
    except urllib.error.HTTPError as e: r = json.load(e)
    print(method, 'ok' if r.get('ok') else r.get('description'))
assert len(SHORT) <= 120 and len(DESC) <= 512 and len(NAME) <= 64, (len(SHORT), len(DESC))
call('setMyName', {'name': NAME})
call('setMyShortDescription', {'short_description': SHORT})
call('setMyDescription', {'description': DESC})
call('setMyCommands', {'commands': [{'command': 'start', 'description': 'شروع'}]})
call('setMyProfilePhoto', {'photo': json.dumps({'type': 'static', 'photo': 'attach://avatar'})}, {'avatar': ('avatar.jpg', open(avatar, 'rb').read())})
