import glob
import re

files = glob.glob('/Users/vidhyarth/Desktop/Groona/groona/src/components/insights/*.jsx')
files.append('/Users/vidhyarth/Desktop/Groona/groona/src/pages/ProjectInsights.jsx')

for filepath in files:
    with open(filepath, 'r') as f:
        content = f.read()
    
    # Remove tracking-tight and tracking-tighter
    new_content = re.sub(r'\btracking-tighter\b', 'tracking-normal', content)
    new_content = re.sub(r'\btracking-tight\b', 'tracking-normal', new_content)
    
    if content != new_content:
        with open(filepath, 'w') as f:
            f.write(new_content)
        print(f"Updated {filepath}")
