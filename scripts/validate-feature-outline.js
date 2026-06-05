#!/usr/bin/env node

/**
 * Validates that all feature files in docs/features/ follow the correct outline structure.
 * 
 * Expected structure:
 * 1. YAML frontmatter (--- ... ---)
 * 2. # Title (H1)
 * 3. ## Overview (H2)
 * 4. ## Implementation (H2)
 * 5. ## Acceptance Criteria (H2)
 * 6. ## Notes (H2)
 * 7. ## Examples (H2)
 */

const fs = require('fs');
const path = require('path');

const FEATURES_DIR = path.join(__dirname, '..', 'docs', 'features');
const REQUIRED_SECTIONS = [
  { level: 1, title: null }, // H1 title (any title)
  { level: 2, title: 'Overview' },
  { level: 2, title: 'Implementation' },
  { level: 2, title: 'Acceptance Criteria' },
  { level: 2, title: 'Notes' },
  { level: 2, title: 'Examples' }
];

function extractFrontmatter(content) {
  const frontmatterRegex = /^---\s*\n([\s\S]*?)\n---\s*\n/;
  const match = content.match(frontmatterRegex);
  if (match) {
    return {
      frontmatter: match[0],
      body: content.slice(match[0].length)
    };
  }
  return { frontmatter: null, body: content };
}

function extractHeadings(content) {
  const lines = content.split('\n');
  const headings = [];
  let inCodeBlock = false;
  let codeBlockFence = '';
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    
    // Check for code block fences
    const fenceMatch = line.match(/^(```+)(.*)$/);
    if (fenceMatch) {
      if (!inCodeBlock) {
        // Starting a code block
        inCodeBlock = true;
        codeBlockFence = fenceMatch[1];
      } else if (line.startsWith(codeBlockFence)) {
        // Ending the code block
        inCodeBlock = false;
        codeBlockFence = '';
      }
      continue;
    }
    
    // Skip headings inside code blocks
    if (inCodeBlock) {
      continue;
    }
    
    // Check for headings
    const headingMatch = line.match(/^(#{1,6})\s+(.+)$/);
    if (headingMatch) {
      headings.push({
        level: headingMatch[1].length,
        title: headingMatch[2].trim(),
        line: i + 1
      });
    }
  }
  
  return headings;
}

function validateFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf-8').replace(/\r\n/g, '\n');
  const { frontmatter, body } = extractFrontmatter(content);
  const headings = extractHeadings(body);
  
  // Debug: log headings found
  if (process.env.DEBUG) {
    console.log(`\n${path.basename(filePath)} headings:`, headings.map(h => `H${h.level}: ${h.title}`));
  }
  
  const errors = [];
  
  // Check for YAML frontmatter
  if (!frontmatter) {
    errors.push('Missing YAML frontmatter (--- ... ---)');
  } else {
    // Validate frontmatter has required fields
    const requiredFields = ['status', 'updateDate', 'priority'];
    for (const field of requiredFields) {
      if (!frontmatter.includes(`${field}:`)) {
        errors.push(`Missing required frontmatter field: ${field}`);
      }
    }
  }
  
  // Check for H1 title
  const h1Headings = headings.filter(h => h.level === 1);
  if (h1Headings.length === 0) {
    errors.push('Missing H1 title');
  } else if (h1Headings.length > 1) {
    errors.push(`Multiple H1 headings found (expected 1, found ${h1Headings.length})`);
  }
  
  // Check required H2 sections in order
  const h2Headings = headings.filter(h => h.level === 2);
  const requiredH2Titles = REQUIRED_SECTIONS
    .filter(s => s.level === 2)
    .map(s => s.title);
  
  const foundH2Titles = h2Headings.map(h => h.title);
  
  // Check that all required sections exist
  for (const requiredTitle of requiredH2Titles) {
    if (!foundH2Titles.includes(requiredTitle)) {
      errors.push(`Missing required section: ## ${requiredTitle}`);
    }
  }
  
  // Check order of H2 sections (only check if all sections exist)
  if (errors.length === 0 || errors.every(e => !e.includes('Missing required section'))) {
    let lastFoundIndex = -1;
    for (const requiredTitle of requiredH2Titles) {
      const foundIndex = foundH2Titles.indexOf(requiredTitle);
      if (foundIndex !== -1) {
        if (foundIndex < lastFoundIndex) {
          errors.push(`Section "## ${requiredTitle}" appears out of order`);
        }
        lastFoundIndex = foundIndex;
      }
    }
  }
  
  return {
    file: path.relative(FEATURES_DIR, filePath),
    errors,
    valid: errors.length === 0
  };
}

function getAllMarkdownFiles(dir) {
  const files = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      // Recursively get files from subdirectories
      files.push(...getAllMarkdownFiles(fullPath));
    } else if (entry.isFile() && entry.name.endsWith('.md') && entry.name !== 'AGENTS.md' && entry.name !== 'todo.md') {
      files.push(fullPath);
    }
  }
  
  return files;
}

function main() {
  const files = getAllMarkdownFiles(FEATURES_DIR);
  
  const results = files.map(validateFile);
  const invalidFiles = results.filter(r => !r.valid);
  
  if (invalidFiles.length > 0) {
    console.error('❌ Feature file outline validation failed:\n');
    invalidFiles.forEach(result => {
      console.error(`📄 ${result.file}:`);
      result.errors.forEach(error => {
        console.error(`   ✗ ${error}`);
      });
      console.error('');
    });
    process.exit(1);
  } else {
    console.log('✅ All feature files have correct outline structure');
    process.exit(0);
  }
}

if (require.main === module) {
  main();
}

module.exports = { validateFile };
