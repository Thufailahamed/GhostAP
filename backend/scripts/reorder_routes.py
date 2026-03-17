file_path = 'c:/Users/user/Downloads/project-v/backend/routers/receivables.py'
with open(file_path, 'r', encoding='utf-8') as f:
    lines = f.readlines()

new_lines = []
aging_and_auto_mark = []
in_special_routes = False

for i, line in enumerate(lines):
    if line.strip() == '# =============================================' and i+1 < len(lines) and 'AGING' in lines[i+1]:
        in_special_routes = True
    
    if in_special_routes:
        aging_and_auto_mark.append(line)
    else:
        new_lines.append(line)

# Now insert aging_and_auto_mark right before @router.get("/{id}", ...)
insert_idx = -1
for i, line in enumerate(new_lines):
    if line.startswith('@router.get("/{id}"'):
        insert_idx = i
        break

if insert_idx != -1 and in_special_routes:
    final_lines = new_lines[:insert_idx] + aging_and_auto_mark + new_lines[insert_idx:]
    with open(file_path, 'w', encoding='utf-8') as f:
        f.writelines(final_lines)
    print("Routes successfully reordered.")
else:
    print("Failed to find insertion point or special routes.")
