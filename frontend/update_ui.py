import re

with open('src/App.jsx', 'r', encoding='utf-8') as f:
    content = f.read()

# Palette Replacements
colors = {
    'bg-slate-50': 'bg-paper',
    'bg-slate-900': 'bg-ink',
    'bg-slate-800': 'bg-ink/90',
    'text-slate-900': 'text-ink',
    'text-slate-800': 'text-ink',
    'text-slate-700': 'text-ink/80',
    'text-slate-600': 'text-slateBlue',
    'text-slate-500': 'text-slateBlue/80',
    'text-emerald-600': 'text-compliant',
    'text-emerald-500': 'text-compliant/80',
    'bg-emerald-600': 'bg-compliant',
    'bg-emerald-500': 'bg-compliant/80',
    'bg-emerald-50': 'bg-compliant/10',
    'bg-emerald-100': 'bg-compliant/20',
    'text-rose-600': 'text-critical',
    'bg-rose-600': 'bg-critical',
    'bg-rose-50': 'bg-critical/10',
    'bg-rose-100': 'bg-critical/20',
    'text-red-600': 'text-critical',
    'text-red-500': 'text-critical',
    'text-red-700': 'text-critical',
    'bg-red-100': 'bg-critical/20',
    'border-red-200': 'border-critical/30',
    'text-amber-600': 'text-violation',
    'bg-amber-600': 'bg-violation',
    'bg-amber-400': 'bg-violation/80',
    'bg-amber-50': 'bg-violation/10',
    'text-blue-600': 'text-slateBlue',
    'text-blue-800': 'text-slateBlue',
    'bg-blue-600': 'bg-slateBlue',
    'bg-blue-500': 'bg-slateBlue/90',
    'bg-blue-100': 'bg-slateBlue/20',
    'bg-blue-50': 'bg-slateBlue/10',
    'border-slate-200': 'border-ink/20',
    'border-slate-100': 'border-ink/10',
}

for old, new in colors.items():
    content = content.replace(old, new)

# Typography (Add font-serif to headers)
content = re.sub(r'<h1([^>]*?)className="([^"]*?)"', r'<h1\1className="\2 font-serif"', content)
content = re.sub(r'<h2([^>]*?)className="([^"]*?)"', r'<h2\1className="\2 font-serif"', content)
content = re.sub(r'<h3([^>]*?)className="([^"]*?)"', r'<h3\1className="\2 font-serif"', content)
content = re.sub(r'<h4([^>]*?)className="([^"]*?)"', r'<h4\1className="\2 font-serif"', content)

# Brutalism/Official document borders instead of generic shadows
content = content.replace('shadow-sm border border-ink/20', 'border-2 border-ink shadow-[4px_4px_0px_0px_rgba(15,27,45,1)] rounded-none')
content = content.replace('shadow-xl border border-ink/20', 'border-2 border-ink shadow-[8px_8px_0px_0px_rgba(15,27,45,1)] rounded-none')
content = content.replace('rounded-xl', 'rounded-none')
content = content.replace('rounded-2xl', 'rounded-none')
content = content.replace('rounded-lg', 'rounded-none')

with open('src/App.jsx', 'w', encoding='utf-8') as f:
    f.write(content)
print("Updated App.jsx colors and base styles!")
