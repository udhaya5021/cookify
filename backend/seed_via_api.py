"""Populates demo data by calling the real, running API — not by writing
rows into the DB directly. Every user, recipe, comment, rating, save and
subscription below goes through the actual signup/upload/comment/rate/
save/subscribe endpoints, so this exercises the same code paths a real
user's browser would.

Requires the backend to already be running (uvicorn app.main:app --port 8000).
Needs `requests` (pip install requests) — dev-only, not a runtime dependency
of the app itself.

Safe to re-run: signup/subscribe/save calls that already exist just get a
400/"already" response, which this script tolerates and moves past.

Run: python3 seed_via_api.py
"""
import io
import requests
from PIL import Image, ImageDraw, ImageFont

BASE = "http://localhost:8000/api"

USERS = [
    dict(username="priya_kitchen", email="priya.kitchen.demo@example.com", phone_number="9876543210",
         password="DemoPass123!", first_name="Priya", last_name="Raman", age=29,
         bio="Home cook from Chennai. I post South Indian breakfast recipes every weekend.",
         avatar_color=(240, 160, 75)),
    dict(username="marco_grills", email="marco.grills.demo@example.com", phone_number="9876500011",
         password="DemoPass123!", first_name="Marco", last_name="Bianchi", age=34,
         bio="Ex-restaurant line cook. Now I just grill things in my backyard and write it down.",
         avatar_color=(181, 101, 47)),
    dict(username="ananya_bakes", email="ananya.bakes.demo@example.com", phone_number="9876500022",
         password="DemoPass123!", first_name="Ananya", last_name="Iyer", age=24,
         bio="Self-taught baker. Sourdough obsessed.",
         avatar_color=(217, 123, 63)),
]


def make_avatar_png(initials: str, color: tuple) -> bytes:
    img = Image.new("RGB", (256, 256), color)
    draw = ImageDraw.Draw(img)
    try:
        font = ImageFont.truetype("/System/Library/Fonts/Supplemental/Arial Bold.ttf", 110)
    except OSError:
        font = ImageFont.load_default()
    bbox = draw.textbbox((0, 0), initials, font=font)
    w, h = bbox[2] - bbox[0], bbox[3] - bbox[1]
    draw.text(((256 - w) / 2 - bbox[0], (256 - h) / 2 - bbox[1]), initials, fill=(255, 255, 255), font=font)
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    return buf.getvalue()

RECIPES = [
    dict(owner="priya_kitchen", title="Masala Dosa",
         ingredients="rice, urad dal, potatoes, onion, mustard seeds, curry leaves, turmeric",
         utensils="tawa, mixer grinder, ladle",
         steps="1. Soak rice and urad dal separately for 6 hours.\n2. Grind to a smooth batter, ferment overnight.\n3. Boil and mash potatoes, saute with onion, mustard seeds, curry leaves and turmeric for the filling.\n4. Spread batter thin on a hot tawa, drizzle oil, cook until golden.\n5. Add filling, fold, serve with chutney and sambar.",
         cost=80, cooking_time_minutes=45, calories=350, protein=8,
         speed=3.5, difficulty=3.0, dietary_tag="vegetarian", food_type="breakfast", region="South Indian"),
    dict(owner="ananya_bakes", title="Classic Sourdough Bread",
         ingredients="bread flour, water, sourdough starter, salt",
         utensils="dutch oven, bench scraper, mixing bowl",
         steps="1. Mix flour, water and starter, autolyse 1 hour.\n2. Add salt, do 4 sets of stretch-and-folds over 2 hours.\n3. Bulk ferment until 50% risen.\n4. Shape, proof overnight in the fridge.\n5. Bake covered at 240C for 20 min, uncovered for 20 more.",
         cost=120, cooking_time_minutes=90, calories=210, protein=6,
         speed=1.5, difficulty=4.5, dietary_tag="vegetarian", food_type="bread", region="European"),
    dict(owner="ananya_bakes", title="Paneer Butter Masala",
         ingredients="paneer, tomato, cashew, butter, cream, garam masala, kasuri methi",
         utensils="kadai, blender",
         steps="1. Blanch and blend tomatoes and cashews into a puree.\n2. Cook puree in butter until oil separates.\n3. Add garam masala, salt, cream.\n4. Add paneer cubes, simmer 5 minutes.\n5. Finish with kasuri methi and a swirl of cream.",
         cost=180, cooking_time_minutes=35, calories=420, protein=18,
         speed=3.0, difficulty=2.5, dietary_tag="vegetarian", food_type="main course", region="North Indian"),
    dict(owner="marco_grills", title="Garlic Butter Grilled Prawns",
         ingredients="prawns, garlic, butter, lemon, chili flakes, parsley",
         utensils="grill, skewers",
         steps="1. Marinate prawns in garlic, lemon juice, chili flakes for 20 minutes.\n2. Skewer and grill 2-3 minutes per side, basting with butter.\n3. Garnish with parsley and serve with lemon wedges.",
         cost=350, cooking_time_minutes=25, calories=280, protein=32,
         speed=4.0, difficulty=2.0, dietary_tag="non_vegetarian", food_type="appetizer", region="Mediterranean"),
    dict(owner="marco_grills", title="Slow-Smoked BBQ Ribs",
         ingredients="pork ribs, brown sugar, paprika, BBQ sauce, apple cider vinegar",
         utensils="smoker, meat thermometer",
         steps="1. Rub ribs with brown sugar, paprika, salt and pepper, rest overnight.\n2. Smoke at 110C for 5-6 hours until tender.\n3. Baste with BBQ sauce in the last 30 minutes.\n4. Rest 10 minutes before slicing.",
         cost=450, cooking_time_minutes=360, calories=610, protein=40,
         speed=0.5, difficulty=3.5, dietary_tag="non_vegetarian", food_type="main course", region="American"),
    dict(owner="priya_kitchen", title="Chicken Chettinad",
         ingredients="chicken, coconut, star anise, dried red chili, curry leaves, shallots",
         utensils="kadai, blender",
         steps="1. Dry roast and grind coconut, star anise, and dried chilies into a paste.\n2. Saute shallots and curry leaves, add chicken, sear.\n3. Add the ground paste, cook covered until chicken is tender.\n4. Adjust salt and simmer until oil separates.",
         cost=220, cooking_time_minutes=50, calories=390, protein=35,
         speed=2.5, difficulty=3.5, dietary_tag="non_vegetarian", food_type="main course", region="South Indian"),
]

COMMENTS = [
    ("marco_grills", "Masala Dosa", "Made this Sunday morning, the fermentation tip really made a difference. Great writeup!"),
    ("ananya_bakes", "Chicken Chettinad", "Love the coconut paste method here, going to try it this weekend."),
    ("priya_kitchen", "Classic Sourdough Bread", "Finally got a decent oven spring following this. Thank you!"),
]

RATINGS = [
    ("marco_grills", "Masala Dosa", 5),
    ("ananya_bakes", "Masala Dosa", 4),
    ("priya_kitchen", "Slow-Smoked BBQ Ribs", 5),
    ("priya_kitchen", "Classic Sourdough Bread", 5),
    ("marco_grills", "Paneer Butter Masala", 4),
]

SAVES = [
    ("priya_kitchen", "Garlic Butter Grilled Prawns"),
    ("ananya_bakes", "Chicken Chettinad"),
]

SUBSCRIPTIONS = [
    ("ananya_bakes", "priya_kitchen"),
    ("marco_grills", "priya_kitchen"),
]


def signup_or_login(u):
    r = requests.post(f"{BASE}/auth/signup", json={
        "email": u["email"], "username": u["username"],
        "password": u["password"], "phone_number": u["phone_number"],
    })
    if r.status_code == 200:
        return r.json()["access_token"], r.json()["user_id"]

    # Already exists — this account has 2FA on, so login here would need an
    # OTP round-trip we can't automate. Look the id up via the public list
    # instead, and skip re-creating a token (recipe/comment/rate calls
    # below will just no-op if already present).
    print(f"  {u['username']} already exists, skipping signup")
    all_recipes = requests.get(f"{BASE}/recipes").json()["recipes"]
    for rec in all_recipes:
        if rec["creator_username"] == u["username"]:
            return None, rec["creator_id"]
    users_probe = requests.get(f"{BASE}/users/1")
    return None, None


def main():
    tokens = {}
    user_ids = {}
    for u in USERS:
        print(f"Signing up {u['username']}...")
        token, user_id = signup_or_login(u)
        tokens[u["username"]] = token
        user_ids[u["username"]] = user_id

        if token:
            initials = (u["first_name"][0] + u["last_name"][0]).upper()
            avatar_png = make_avatar_png(initials, u["avatar_color"])
            resp = requests.put(
                f"{BASE}/users/me",
                headers={"Authorization": f"Bearer {token}"},
                data={"first_name": u["first_name"], "last_name": u["last_name"],
                      "age": u["age"], "bio": u["bio"]},
                files={"profile_picture": (f"{u['username']}.png", avatar_png, "image/png")},
            )
            print(f"  Profile filled for {u['username']}: {resp.status_code}")

    recipe_ids = {}
    for r in RECIPES:
        token = tokens.get(r["owner"])
        if not token:
            print(f"  Skipping recipe '{r['title']}' — no fresh token for {r['owner']} (already existed)")
            continue
        resp = requests.post(
            f"{BASE}/recipes",
            headers={"Authorization": f"Bearer {token}"},
            data={k: v for k, v in r.items() if k != "owner"},
        )
        if resp.status_code == 200:
            recipe_ids[r["title"]] = resp.json()["recipe"]["id"]
            print(f"  Uploaded '{r['title']}'")
        else:
            print(f"  Upload failed for '{r['title']}': {resp.status_code} {resp.text}")

    if not recipe_ids:
        print("No new recipes uploaded (likely already seeded) — fetching existing ids for comments/ratings/saves.")
        all_recipes = requests.get(f"{BASE}/recipes").json()["recipes"]
        recipe_ids = {rec["title"]: rec["id"] for rec in all_recipes}

    for username, title, text in COMMENTS:
        token, rid = tokens.get(username), recipe_ids.get(title)
        if not token or not rid:
            continue
        resp = requests.post(f"{BASE}/recipes/{rid}/comments", headers={"Authorization": f"Bearer {token}"}, json={"text": text})
        print(f"  Comment by {username} on '{title}': {resp.status_code}")

    for username, title, score in RATINGS:
        token, rid = tokens.get(username), recipe_ids.get(title)
        if not token or not rid:
            continue
        resp = requests.post(f"{BASE}/recipes/{rid}/ratings", headers={"Authorization": f"Bearer {token}"}, json={"score": score})
        print(f"  Rating by {username} on '{title}': {resp.status_code}")

    for username, title in SAVES:
        token, rid = tokens.get(username), recipe_ids.get(title)
        if not token or not rid:
            continue
        resp = requests.post(f"{BASE}/recipes/{rid}/save", headers={"Authorization": f"Bearer {token}"})
        print(f"  Save by {username} of '{title}': {resp.status_code}")

    for sub_username, creator_username in SUBSCRIPTIONS:
        token, creator_id = tokens.get(sub_username), user_ids.get(creator_username)
        if not token or not creator_id:
            continue
        resp = requests.post(f"{BASE}/users/{creator_id}/subscribe", headers={"Authorization": f"Bearer {token}"})
        print(f"  Subscribe {sub_username} -> {creator_username}: {resp.status_code}")

    print("\nDone. Demo users (password: DemoPass123!):")
    for u in USERS:
        print(f"  {u['username']} / {u['email']}")


if __name__ == "__main__":
    main()
