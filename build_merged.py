#!/usr/bin/env python3
"""
Merge interactive_quiz.html into asset_generator.html
Creates a single file that generates assets and outputs ready quiz
"""

import re

# Read interactive quiz
with open('interactive_quiz.html', 'r', encoding='utf-8') as f:
    quiz_html = f.read()

# Replace QUIZ_ASSETS placeholder with injection marker
quiz_html = re.sub(
    r'const QUIZ_ASSETS = \{[^}]*\};',
    '/*INJECT_ASSETS_HERE*/',
    quiz_html,
    flags=re.DOTALL
)

# Escape for JavaScript template literal
quiz_template = quiz_html.replace('\\', '\\\\').replace('`', '\\`').replace('$', '\\$')

# Read asset generator
with open('asset_generator.html', 'r', encoding='utf-8') as f:
    generator_html = f.read()

# Insert template before window.generateSingle declaration
template_declaration = f'\n// Quiz template with injection marker\nconst QUIZ_TEMPLATE = `{quiz_template}`;\n\n'

# Find window.generateSingle and insert before it
marker = 'window.generateSingle = generateSingle;'
if marker in generator_html:
    generator_html = generator_html.replace(marker, template_declaration + marker)
else:
    # Fallback: insert before </script> in the module script
    # Find the <script type="module"> section and insert before its closing tag
    parts = generator_html.split('</script>')
    # Insert before the last closing script tag (the module one)
    if len(parts) >= 2:
        generator_html = parts[0] + template_declaration + '</script>' + '</script>'.join(parts[1:])

# Write merged file
with open('quiz_generator_ALL_IN_ONE.html', 'w', encoding='utf-8') as f:
    f.write(generator_html)

print('✅ Created: quiz_generator_ALL_IN_ONE.html')
print('📊 Size:', len(generator_html), 'bytes')
print('\nThis file can:')
print('1. Generate all food images with AI')
print('2. Automatically inject them into quiz')
print('3. Download ready-to-deploy interactive_quiz_READY.html')
print('\nNo manual copying needed!')
