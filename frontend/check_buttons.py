import os
import re

for root, dirs, files in os.walk('src'):
    for file in files:
        if file.endswith('.tsx') or file.endswith('.jsx'):
            with open(os.path.join(root, file), 'r', encoding='utf-8') as f:
                content = f.read()
                buttons = re.findall(r'<Button[^>]*>', content)
                for b in buttons:
                    m = re.search(r'className=[\"\']([^\"\']+)[\"\']', b)
                    if m:
                        cls = m.group(1)
                        if 'hover:bg-terminal-green' in cls and 'hover:text-black' not in cls:
                            print(f'Missing hover:text-black: {file} -> {cls}')
                        if 'bg-terminal-green' in cls and 'text-black' not in cls:
                            print(f'Missing text-black on solid green: {file} -> {cls}')
                        if 'hover:bg-terminal-cyan' in cls and 'hover:text-black' not in cls:
                            print(f'Missing hover:text-black on cyan: {file} -> {cls}')
