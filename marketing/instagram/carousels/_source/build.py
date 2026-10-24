import os, html

D = os.path.dirname(os.path.abspath(__file__))
OWL = '''<path transform="translate(406.02,347.75) rotate(-32)" d="M0,0 C-51.2,-19.71 -51.2,-92.93 0,-112.64 C51.2,-92.93 51.2,-19.71 0,0 Z" fill="#4C7A52"/><path transform="translate(617.98,347.75) rotate(32)" d="M0,0 C-51.2,-19.71 -51.2,-92.93 0,-112.64 C51.2,-92.93 51.2,-19.71 0,0 Z" fill="#1F3D2B"/><path d="M512,327.68 C281.6,327.68 240.13,704.0 350.72,829.44 C442.88,874.6 512,874.6 512,834.46 Z" fill="#1F3D2B"/><path d="M512,327.68 C742.4,327.68 782.87,704.0 673.28,829.44 C581.12,874.6 512,874.6 512,834.46 Z" fill="#4C7A52"/><circle cx="415.23" cy="548.45" r="76.8" fill="#F7F5EC"/><circle cx="608.77" cy="548.45" r="76.8" fill="#F7F5EC"/><circle cx="415.23" cy="548.45" r="32.77" fill="#1F3D2B"/><circle cx="608.77" cy="548.45" r="32.77" fill="#1F3D2B"/><path d="M487.42,593.61 L536.58,593.61 L512,623.72 Z" fill="#E3B94C"/>'''

CSS = '''
html,body{margin:0;width:1080px;height:1440px;overflow:hidden}
body{position:relative;font-family:'Work Sans',sans-serif;color:#1F3D2B;background:var(--bg)}
.top{position:absolute;left:80px;right:80px;top:70px;display:flex;align-items:center;justify-content:space-between}
.brand{display:flex;align-items:center;gap:16px;font-family:'IBM Plex Mono',monospace;font-size:26px;letter-spacing:5px;text-transform:uppercase;color:#1F3D2B}
.brand .ic{width:56px;height:56px;border-radius:15px;background:linear-gradient(160deg,#F7EFD9,#EDDCAE);display:flex;align-items:center;justify-content:center}
.count{font-family:'IBM Plex Mono',monospace;font-size:26px;letter-spacing:3px;color:var(--accent)}
.kicker{font-family:'IBM Plex Mono',monospace;font-size:30px;letter-spacing:5px;text-transform:uppercase;color:var(--accent)}
h1{font-family:'Fraunces',serif;font-weight:600;color:#1F3D2B;margin:0;letter-spacing:-1.5px;text-wrap:balance}
p{margin:0;text-wrap:pretty}
.emo{position:absolute;filter:drop-shadow(0 26px 34px rgba(31,61,43,0.16))}
/* cover */
.cover .head{position:absolute;left:80px;right:80px;top:200px}
.cover h1{font-size:124px;line-height:1.0;margin-top:22px}
.cover .sub{font-size:46px;line-height:1.38;color:#4A4F42;margin-top:34px;max-width:820px}
.swipe{position:absolute;left:80px;bottom:80px;font-family:'IBM Plex Mono',monospace;font-size:28px;letter-spacing:4px;text-transform:uppercase;color:#F7F5EC;background:#1F3D2B;border-radius:999px;padding:20px 34px}
/* tip slides */
.tip .wrap{position:absolute;left:80px;right:80px;top:170px;bottom:110px;display:flex;flex-direction:column;justify-content:center}
.tip .em{position:relative;width:340px;height:340px;margin-bottom:56px}
.tip .num{position:absolute;right:80px;top:200px;font-family:'Fraunces',serif;font-weight:600;font-size:170px;line-height:1;color:var(--accent);opacity:0.22}
.tip h1{font-size:98px;line-height:1.04}
.tip .list{font-family:'Fraunces',serif;font-weight:600;font-style:italic;font-size:64px;line-height:1.15;color:var(--accent);margin-top:26px}
.tip .body{font-size:48px;line-height:1.45;color:#4A4F42;margin-top:36px}
.note{margin-top:44px;background:rgba(255,255,255,0.6);border-left:8px solid #E3B94C;border-radius:18px;padding:28px 32px;font-size:36px;line-height:1.42;color:#1F3D2B}
.note b{font-family:'IBM Plex Mono',monospace;font-size:24px;letter-spacing:3px;text-transform:uppercase;color:#B8862A;display:block;margin-bottom:8px;font-weight:600}
/* last */
.last{background:radial-gradient(ellipse 900px 700px at 20% 0%,rgba(227,185,76,0.18),transparent 60%),linear-gradient(170deg,#1F3D2B 0%,#142719 100%);color:#F7F5EC}
.last .brand{color:#CFE0CD}.last .count{color:#E3B94C}
.last .center{position:absolute;left:90px;right:90px;top:250px;bottom:120px;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center}
.last .big{width:300px;height:300px;border-radius:72px;background:linear-gradient(160deg,#F7EFD9,#EDDCAE);display:flex;align-items:center;justify-content:center;box-shadow:0 30px 70px rgba(0,0,0,0.35)}
.last h1{color:#F7F5EC;font-size:100px;line-height:1.04;margin-top:64px}
.last .body{font-size:44px;line-height:1.42;color:#CFE0CD;margin-top:36px}
.last .pill{margin-top:56px;font-weight:600;font-size:42px;color:#241a05;background:#E3B94C;border-radius:999px;padding:24px 48px}
'''

FONTS = '<link href="https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,600;1,9..144,600&family=Work+Sans:wght@500;600&family=IBM+Plex+Mono:wght@600&display=swap" rel="stylesheet">'

def e(code):
    return f'emoji/emoji_u{code}.svg'

def page(theme, cls, inner, n, total, subtop=None):
    style = f"--bg:{theme['bg']};--accent:{theme['accent']};" + (f"--subtop:{subtop}px;" if subtop else '')
    top = f'''<div class="top"><div class="brand"><div class="ic"><svg viewBox="0 0 1024 1024" width="50" height="50">{OWL}</svg></div>GardenWise</div><div class="count">{n} / {total}</div></div>'''
    return f'''<!doctype html><html><head><meta charset="utf-8">{FONTS}<style>{CSS}</style></head><body class="{cls}" style="{style}">{top}{inner}</body></html>'''

def esc(s):
    return html.escape(s, quote=False)

CAROUSELS = [
  dict(slug='1-fall-leaves', bg='#F6E7D4', accent='#A8592A',
    kicker='Fall garden tip', title="Don't throw out your fall leaves",
    sub="They're free garden gold. Here's what to do with them.", subtop=900,
    cover=[('1f342', 420, 600, 860, -12), ('1f341', 260, 360, 1010, 14), ('1f343', 210, 830, 760, 8)],
    tips=[
      ('1f333', 'Leaves are free fertilizer', None, "Trees pull nutrients up from deep in the soil all summer. When their leaves fall, those nutrients can go right back into your garden.", None),
      ('1f342', 'Shred them into mulch', None, "Run the mower over a pile to chop them up, then spread 2–3 inches over bare beds. It keeps weeds down and stops soil washing away.", ('Good to know', 'Whole leaves can mat into a soggy layer. Shredded ones break down much faster.')),
      ('1f9fa', 'Make leaf mold', None, "Pile damp leaves in a corner, or in a bag with a few holes poked in it. In 6–12 months they turn into dark, crumbly stuff that helps soil hold water.", None),
      ('1fab1', 'Feed your compost', None, 'Leaves are the perfect “brown” for a compost pile. Mix about 2 parts leaves to 1 part kitchen scraps and keep it damp.', None),
      ('1f98b', 'Leave a little for wildlife', None, 'Many butterflies, moths, and helpful insects spend winter tucked in leaf litter. Leave one quiet corner unraked.', None),
    ],
    save='Save this for leaf season 🍂', tie=None),
  dict(slug='2-plant-garlic', bg='#EFE9F3', accent='#76558A',
    kicker='Plant now, harvest next summer', title="It's not too late to plant garlic",
    sub="Fall is garlic season. Here's how to do it.", subtop=900,
    cover=[('1f9c4', 430, 600, 840, -8), ('1f9c4', 250, 370, 1040, 12), ('1f331', 220, 850, 760, 6)],
    tips=[
      ('2744', 'Why plant in fall?', None, 'Garlic needs a few weeks of cold to split into a full bulb of cloves. Spring-planted garlic usually gives you small bulbs.', None),
      ('1f342', 'When to plant', None, 'A few weeks before your ground freezes, usually after your first fall frost. In mild-winter areas, that can be November or December.', None),
      ('1f9c4', 'Pick the biggest cloves', None, 'Start with seed garlic or bulbs from a local farm. Break them apart just before planting and keep the biggest cloves. Big cloves grow big bulbs.', ('Good to know', 'Grocery-store garlic is often grown for a different climate, so results can be hit or miss.')),
      ('1f331', 'Pointy end up', None, 'Plant each clove about 2 inches deep and 6 inches apart, with the flat root end down.', None),
      ('1f33e', 'Tuck it in with mulch', None, 'Once the soil has cooled, cover the bed with 4–6 inches of straw or shredded leaves. Pull it back a little when shoots appear in spring.', None),
      ('1f9c4', 'Harvest next summer', None, 'When the lower third of the leaves turn brown, it’s ready. Dry the bulbs somewhere airy for a few weeks before storing.', None),
    ],
    save='Save this for garlic season 🧄', tie='GardenWise times your garlic planting to your own first fall frost.'),
  dict(slug='3-fall-cleanup', bg='#E4EEDC', accent='#3F7048',
    kicker='Before winter', title='Your fall garden cleanup checklist',
    sub='Six jobs now that make spring so much easier.', subtop=900,
    cover=[('1f9f9', 400, 620, 860, 10), ('1f9e4', 250, 380, 1040, -12), ('1f342', 210, 860, 760, 8)],
    tips=[
      ('1f5d1', 'Remove diseased plants', None, 'Bag them up and put them in the trash, not the compost. Diseases like blight can survive the winter and come right back.', None),
      ('2702', 'Cut, don’t pull, healthy plants', None, 'Snip spent plants off at soil level and leave the roots in the ground. They break down over winter and feed the soil.', None),
      ('1f342', 'Cover bare soil', None, 'Spread mulch or shredded leaves over empty beds. Bare soil washes away and wakes up to a fresh crop of weeds.', None),
      ('1f527', 'Clean and sharpen tools', None, 'Scrub off the dirt, dry them, sharpen the blades, and wipe with a little oil so they don’t rust over winter.', None),
      ('1f4a7', 'Drain hoses and drip lines', None, 'Water left inside can freeze, expand, and crack them. Drain everything and store it indoors.', None),
      ('1f4dd', 'Write down what you learned', None, 'What thrived, what flopped, what you’d plant somewhere else next year. Future you will thank you.', ('In GardenWise', 'Every plant has a Notes & learnings section for exactly this.')),
    ],
    save='Save this checklist ✅', tie=None, numbered=True),
  dict(slug='4-frost-protection', bg='#E1ECF3', accent='#3B6789',
    kicker='Frost tonight?', title='How to protect your plants from frost',
    sub='A few simple steps can save a whole bed.', subtop=900,
    cover=[('2744', 380, 620, 860, -10), ('1f96c', 270, 360, 1030, 10), ('1f345', 210, 860, 760, 8)],
    tips=[
      ('1f321', 'Know your plant’s limit', None, 'Tomatoes, peppers, and basil are hurt by any frost. Lettuce and chard can handle a light one. Kale and collards are fine into the low 20s°F.', None),
      ('1f4a7', 'Water the day before', None, 'Moist soil holds heat better than dry soil, and slowly releases it overnight.', None),
      ('1f305', 'Cover before sunset', None, 'The ground soaks up warmth all day. Covering in the late afternoon traps that warmth around your plants.', None),
      ('1f6e1', 'Use cloth, not plastic', None, 'Frost cloth, old sheets, or blankets work best. Drape them all the way to the ground. Plastic touching leaves can make damage worse.', None),
      ('1fab4', 'Bring pots inside', None, 'Containers freeze much faster than the ground. Move them into a garage, or right up against the house.', None),
      ('2600', 'Uncover in the morning', None, 'Once it’s above freezing, take the covers off so plants get sun and don’t overheat.', None),
    ],
    save='Save this for the next cold snap ❄️', tie='GardenWise warns you about a frost and names exactly which plants to cover.'),
  dict(slug='5-seed-lifespans', bg='#F3EBD6', accent='#91631A',
    kicker='Before you buy new seeds', title='How long do seeds actually last?',
    sub='Check your seed stash before you order more.', subtop=900,
    cover=[('1fad9', 400, 620, 850, -6), ('1f345', 240, 380, 1040, 12), ('1f331', 220, 860, 760, 8)],
    tips=[
      ('1f9c5', 'About 1–2 years', 'Onions, parsnips', 'These lose their spark fast. Buy fresh every year or two.', None),
      ('1f336', 'About 2–3 years', 'Peppers, corn, leeks, parsley, spinach', 'Still good for a couple of seasons if stored well.', None),
      ('1f955', 'About 3–4 years', 'Carrots, beans, peas', 'Solid for a few years. Older packets may just sprout a little less.', None),
      ('1f345', 'About 4–6 years', 'Tomatoes, cucumbers, squash, lettuce', 'The long-lasters. A packet can cover several seasons.', ('Good to know', 'These are typical ranges. Seeds stored well often last longer.')),
      ('1fad9', 'Store them right', None, 'Cool, dark, and dry. A sealed jar in a closet or the fridge works great. Add a silica packet and label everything with the year.', None),
      ('1f50d', 'Not sure? Test them.', None, 'Old seeds often still sprout, just fewer of them. A quick paper-towel test tells you. We’ll show you how next month.', None),
    ],
    save='Save this before you order seeds 🌱', tie=None),
  dict(slug='6-winter-herbs', bg='#DCEEDF', accent='#2E6A45',
    kicker='Before the first hard freeze', title='Which herbs to bring inside for winter',
    sub='And which ones are tough enough to stay out.', subtop=900,
    cover=[('1fab4', 400, 620, 850, 6), ('1f33f', 260, 370, 1030, -12), ('1f343', 210, 860, 760, 10)],
    tips=[
      ('1fab4', 'Bring in: rosemary', None, 'Rosemary often doesn’t survive cold winters. Pot it up and give it your sunniest window.', None),
      ('1f33f', 'Bring in: basil', None, 'Basil can’t take any frost. Instead of digging up the plant, root a few cuttings in a glass of water.', None),
      ('1f33f', 'Your choice: parsley', None, 'Parsley is surprisingly tough. Pot a small plant for the kitchen, or mulch it outside and it may keep going.', None),
      ('1f343', 'Leave outside', 'Mint, chives, thyme, oregano, sage', 'Tough perennials that come back on their own in most climates. Cut them back and add some mulch.', None),
      ('1fa9f', 'Indoor herb care', None, 'Give them your brightest spot, or a grow light for 12–14 hours a day. Water when the top inch of soil is dry. Soggy roots are the #1 killer.', None),
    ],
    save='Save this for frost season 🌿', tie=None),
]

def build(c):
    out = os.path.join(D, 'html', c['slug'])
    os.makedirs(out, exist_ok=True)
    total = len(c['tips']) + 2
    theme = dict(bg=c['bg'], accent=c['accent'])
    emos = ''.join(f'<img class="emo" src="../../{e(code)}" style="width:{s}px;height:{s}px;left:{x + 40 - s/2}px;top:{y + 220 - s/2}px;transform:rotate({r}deg)">' for code, s, x, y, r in c['cover'])
    inner = f'<div class="head"><div class="kicker">{esc(c["kicker"])}</div><h1>{esc(c["title"])}</h1><p class="sub">{esc(c["sub"])}</p></div>{emos}<div class="swipe">Swipe →</div>'
    files = []
    pages = [page(theme, 'cover', inner, 1, total, c['subtop'])]
    for i, (code, h, lst, body, note) in enumerate(c['tips'], start=1):
        num = f'<div class="num">{i:02d}</div>' if c.get('numbered') else ''
        lst_html = f'<div class="list">{esc(lst)}</div>' if lst else ''
        note_html = f'<div class="note"><b>{esc(note[0])}</b>{esc(note[1])}</div>' if note else ''
        inner = f'{num}<div class="wrap"><img class="emo em" src="../../{e(code)}"><h1>{esc(h)}</h1>{lst_html}<p class="body">{esc(body)}</p>{note_html}</div>'
        pages.append(page(theme, 'tip', inner, i + 1, total))
    tie = c['tie'] or 'GardenWise times every planting, feeding, and frost job to your exact backyard.'
    inner = f'<div class="center"><div class="big"><svg viewBox="0 0 1024 1024" width="270" height="270">{OWL}</svg></div><h1>{esc(c["save"])}</h1><p class="body">{esc(tie)}</p><div class="pill">gardenwise.io · link in bio</div></div>'
    pages.append(page(theme, 'last', inner, total, total))
    for n, h in enumerate(pages, start=1):
        fn = os.path.join(out, f'{n:02d}.html')
        open(fn, 'w').write(h)
        files.append(fn)
    return files

if __name__ == '__main__':
    for c in CAROUSELS:
        build(c)
    print('built', len(CAROUSELS))
