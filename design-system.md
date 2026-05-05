
# Freelancing Platform Color System
**Brand Color:** `#f97316`

Modern, trusted, energetic marketplace UI.

---

# 1. Core Brand Palette

| Role | Name | Hex |
|------|------|------|
| Primary | Orange 500 | `#f97316` |
| Primary Hover | Orange 600 | `#ea580c` |
| Primary Active | Orange 700 | `#c2410c` |
| Primary Soft | Orange 50 | `#fff7ed` |
| Primary Border | Orange 200 | `#fed7aa` |

---

# 2. Neutral Palette

| Role | Hex |
|------|------|
| Background | `#ffffff` |
| Surface | `#f8fafc` |
| Surface 2 | `#f1f5f9` |
| Border | `#e5e7eb` |
| Divider | `#d1d5db` |

---

# 3. Text Colors

| Role | Hex |
|------|------|
| Primary Text | `#111827` |
| Secondary Text | `#4b5563` |
| Muted Text | `#6b7280` |
| Placeholder | `#9ca3af` |
| Inverse Text | `#ffffff` |

---

# 4. Semantic Colors

| Role | Hex |
|------|------|
| Success | `#16a34a` |
| Warning | `#f59e0b` |
| Error | `#dc2626` |
| Info | `#2563eb` |

---

# 5. Dark Mode Palette

| Role | Hex |
|------|------|
| Background | `#0f172a` |
| Surface | `#111827` |
| Surface 2 | `#1f2937` |
| Border | `#374151` |
| Text | `#f9fafb` |
| Muted Text | `#9ca3af` |
| Brand | `#f97316` |

---

# 6. Button System

## Primary Button

Background: `#f97316`  
Text: `#ffffff`

Hover: `#ea580c`

```css
bg-[#f97316] hover:bg-[#ea580c] text-white
````

## Secondary Button

Background: `#ffffff`
Border: `#e5e7eb`

```css
bg-white border border-gray-200 text-gray-900
```

## Ghost Button

```css
text-[#f97316] hover:bg-orange-50
```

---

# 7. Card Example

```html
<div class="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm">
  <h3 class="text-gray-900 font-semibold">UI Designer</h3>
  <p class="text-gray-500 text-sm">Lagos, Nigeria</p>
  <button class="mt-4 bg-[#f97316] text-white px-4 py-2 rounded-xl">
    Hire Now
  </button>
</div>
```

---

# 8. Navbar Example

```html
<nav class="bg-white border-b border-gray-200 px-6 py-4">
  <div class="flex justify-between items-center">
    <h1 class="font-bold text-xl text-[#f97316]">BrandName</h1>

    <div class="flex gap-6 text-gray-700">
      <a href="#">Find Talent</a>
      <a href="#">Jobs</a>
      <a href="#">Pricing</a>
    </div>

    <button class="bg-[#f97316] text-white px-4 py-2 rounded-xl">
      Sign Up
    </button>
  </div>
</nav>
```

---

# 9. Dashboard Sidebar Example

```css
bg-white border-r border-gray-200
```

Active Nav Item:

```css
bg-orange-50 text-[#f97316]
```

Inactive:

```css
text-gray-600 hover:bg-gray-50
```

---

# 10. Input Fields

Default:

```css
border border-gray-300 bg-white
```

Focus:

```css
focus:ring-2 focus:ring-orange-200 focus:border-[#f97316]
```

Error:

```css
border-red-500 focus:ring-red-200
```

---

# 11. Tags / Badges

## Available Now

```css
bg-green-100 text-green-700
```

## Top Rated

```css
bg-orange-100 text-orange-700
```

## New Freelancer

```css
bg-blue-100 text-blue-700
```

---

# 12. Homepage Hero Example

```html
<section class="bg-gradient-to-b from-white to-orange-50 py-24">
  <h1 class="text-6xl font-bold text-gray-900">
    Hire Elite Freelancers Faster
  </h1>

  <p class="text-gray-600 mt-4">
    Trusted talent. Instant hiring. Secure payments.
  </p>

  <button class="mt-8 bg-[#f97316] text-white px-6 py-3 rounded-2xl">
    Get Started
  </button>
</section>
```

---

# 13. Shadows

```css
shadow-sm
shadow-md
shadow-lg
```

Use lightly.

---

# 14. Border Radius

| Element | Radius |
| ------- | ------ |
| Buttons | `12px` |
| Cards   | `20px` |
| Inputs  | `12px` |
| Modals  | `24px` |

---

# 15. Typography

## Recommended Fonts

* Inter
* Sora
* Manrope
* Plus Jakarta Sans

## My Pick

Headings: **Sora**
Body: **Inter**

---

# 16. Brand Feel

Your platform should feel:

* Fast
* Premium
* Friendly
* Trustworthy
* Ambitious

---

# 17. Golden Rule

Use orange as the **spark**, not the whole fire.

10% orange
90% clean neutrals

That creates premium UI.

```
```
