
import fs from 'fs';
import path from 'path';

function walk(dir) {
    const files = fs.readdirSync(dir);
    for (const file of files) {
        const filePath = path.join(dir, file);
        const stat = fs.statSync(filePath);
        if (stat.isDirectory()) {
            if (file !== 'node_modules' && file !== '.git') {
                walk(filePath);
            }
        } else {
            if (!filePath.endsWith('.ts') && !filePath.endsWith('.tsx') && !filePath.endsWith('.js')) continue;
            try {
                const content = fs.readFileSync(filePath, 'utf-8');
                const lines = content.split('\n');
                if (lines.length >= 44) {
                    const line44 = lines[43]; // 0-indexed
                    if (line44.length >= 70) {
                        console.log(`File: ${filePath}`);
                        console.log(`Line 44 (${line44.length}): ${line44}`);
                    }
                }
            } catch (e) { }
        }
    }
}

walk(process.cwd());
