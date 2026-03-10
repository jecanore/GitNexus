import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';
import { shouldIgnorePath, isIgnoredDirectory, loadIgnoreRules, createIgnoreFilter } from '../../src/config/ignore-service.js';

describe('shouldIgnorePath', () => {
  describe('version control directories', () => {
    it.each(['.git', '.svn', '.hg', '.bzr'])('ignores %s directory', (dir) => {
      expect(shouldIgnorePath(`${dir}/config`)).toBe(true);
      expect(shouldIgnorePath(`project/${dir}/HEAD`)).toBe(true);
    });
  });

  describe('IDE/editor directories', () => {
    it.each(['.idea', '.vscode', '.vs'])('ignores %s directory', (dir) => {
      expect(shouldIgnorePath(`${dir}/settings.json`)).toBe(true);
    });
  });

  describe('dependency directories', () => {
    it.each([
      'node_modules', 'vendor', 'venv', '.venv', '__pycache__',
      'site-packages', '.mypy_cache', '.pytest_cache',
    ])('ignores %s directory', (dir) => {
      expect(shouldIgnorePath(`project/${dir}/some-file.js`)).toBe(true);
    });
  });

  describe('build output directories', () => {
    it.each([
      'dist', 'build', 'out', 'output', 'bin', 'obj', 'target',
      '.next', '.nuxt', '.vercel', '.parcel-cache', '.turbo',
    ])('ignores %s directory', (dir) => {
      expect(shouldIgnorePath(`${dir}/bundle.js`)).toBe(true);
    });
  });

  describe('test/coverage directories', () => {
    it.each(['coverage', '__tests__', '__mocks__', '.nyc_output'])('ignores %s directory', (dir) => {
      expect(shouldIgnorePath(`${dir}/results.json`)).toBe(true);
    });
  });

  describe('ignored file extensions', () => {
    it.each([
      // Images
      '.png', '.jpg', '.jpeg', '.gif', '.svg', '.ico', '.webp',
      // Archives
      '.zip', '.tar', '.gz', '.rar',
      // Binary/Compiled
      '.exe', '.dll', '.so', '.dylib', '.class', '.jar', '.pyc', '.wasm',
      // Documents
      '.pdf', '.doc', '.docx',
      // Media
      '.mp4', '.mp3', '.wav',
      // Fonts
      '.woff', '.woff2', '.ttf',
      // Databases
      '.db', '.sqlite',
      // Source maps
      '.map',
      // Lock files
      '.lock',
      // Certificates
      '.pem', '.key', '.crt',
      // Data files
      '.csv', '.parquet', '.pkl',
    ])('ignores files with %s extension', (ext) => {
      expect(shouldIgnorePath(`assets/file${ext}`)).toBe(true);
    });
  });

  describe('ignored files by exact name', () => {
    it.each([
      'package-lock.json', 'yarn.lock', 'pnpm-lock.yaml',
      'composer.lock', 'Cargo.lock', 'go.sum',
      '.gitignore', '.gitattributes', '.npmrc', '.editorconfig',
      '.prettierrc', '.eslintignore', '.dockerignore',
      'LICENSE', 'LICENSE.md', 'CHANGELOG.md',
      '.env', '.env.local', '.env.production',
    ])('ignores %s', (fileName) => {
      expect(shouldIgnorePath(fileName)).toBe(true);
      expect(shouldIgnorePath(`project/${fileName}`)).toBe(true);
    });
  });

  describe('compound extensions', () => {
    it('ignores .min.js files', () => {
      expect(shouldIgnorePath('dist/bundle.min.js')).toBe(true);
    });

    it('ignores .bundle.js files', () => {
      expect(shouldIgnorePath('dist/app.bundle.js')).toBe(true);
    });

    it('ignores .chunk.js files', () => {
      expect(shouldIgnorePath('dist/vendor.chunk.js')).toBe(true);
    });

    it('ignores .min.css files', () => {
      expect(shouldIgnorePath('dist/styles.min.css')).toBe(true);
    });
  });

  describe('generated files', () => {
    it('ignores .generated. files', () => {
      expect(shouldIgnorePath('src/api.generated.ts')).toBe(true);
    });

    it('ignores TypeScript declaration files', () => {
      expect(shouldIgnorePath('types/index.d.ts')).toBe(true);
    });
  });

  describe('Windows path normalization', () => {
    it('normalizes backslashes to forward slashes', () => {
      expect(shouldIgnorePath('node_modules\\express\\index.js')).toBe(true);
      expect(shouldIgnorePath('project\\.git\\HEAD')).toBe(true);
    });
  });

  describe('files that should NOT be ignored', () => {
    it.each([
      'src/index.ts',
      'src/components/Button.tsx',
      'lib/utils.py',
      'cmd/server/main.go',
      'src/main.rs',
      'app/Models/User.php',
      'Sources/App.swift',
      'src/App.java',
      'src/main.c',
      'src/main.cpp',
      'src/Program.cs',
    ])('does not ignore source file %s', (filePath) => {
      expect(shouldIgnorePath(filePath)).toBe(false);
    });
  });
});

describe('isIgnoredDirectory', () => {
  it('returns true for known ignored directories', () => {
    expect(isIgnoredDirectory('node_modules')).toBe(true);
    expect(isIgnoredDirectory('.git')).toBe(true);
    expect(isIgnoredDirectory('dist')).toBe(true);
    expect(isIgnoredDirectory('__pycache__')).toBe(true);
  });

  it('returns false for source directories', () => {
    expect(isIgnoredDirectory('src')).toBe(false);
    expect(isIgnoredDirectory('lib')).toBe(false);
    expect(isIgnoredDirectory('app')).toBe(false);
    expect(isIgnoredDirectory('local')).toBe(false);
  });
});

describe('loadIgnoreRules', () => {
  let tmpDir: string;

  beforeAll(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'gn-ignore-test-'));
  });

  afterAll(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it('returns null when no ignore files exist', async () => {
    const result = await loadIgnoreRules(tmpDir);
    expect(result).toBeNull();
  });

  it('parses .gitignore file', async () => {
    await fs.writeFile(path.join(tmpDir, '.gitignore'), 'data/\nlogs/\n');
    const ig = await loadIgnoreRules(tmpDir);
    expect(ig).not.toBeNull();
    expect(ig!.ignores('data/file.txt')).toBe(true);
    expect(ig!.ignores('logs/app.log')).toBe(true);
    expect(ig!.ignores('src/index.ts')).toBe(false);
    await fs.unlink(path.join(tmpDir, '.gitignore'));
  });

  it('parses .gitnexusignore file', async () => {
    await fs.writeFile(path.join(tmpDir, '.gitnexusignore'), 'vendor/\n*.test.ts\n');
    const ig = await loadIgnoreRules(tmpDir);
    expect(ig).not.toBeNull();
    expect(ig!.ignores('vendor/lib.js')).toBe(true);
    expect(ig!.ignores('src/app.test.ts')).toBe(true);
    expect(ig!.ignores('src/app.ts')).toBe(false);
    await fs.unlink(path.join(tmpDir, '.gitnexusignore'));
  });

  it('combines both files', async () => {
    await fs.writeFile(path.join(tmpDir, '.gitignore'), 'data/\n');
    await fs.writeFile(path.join(tmpDir, '.gitnexusignore'), 'vendor/\n');
    const ig = await loadIgnoreRules(tmpDir);
    expect(ig).not.toBeNull();
    expect(ig!.ignores('data/file.txt')).toBe(true);
    expect(ig!.ignores('vendor/lib.js')).toBe(true);
    expect(ig!.ignores('src/index.ts')).toBe(false);
    await fs.unlink(path.join(tmpDir, '.gitignore'));
    await fs.unlink(path.join(tmpDir, '.gitnexusignore'));
  });

  it('handles comments and blank lines', async () => {
    await fs.writeFile(path.join(tmpDir, '.gitignore'), '# comment\n\ndata/\n\n# another comment\n');
    const ig = await loadIgnoreRules(tmpDir);
    expect(ig).not.toBeNull();
    expect(ig!.ignores('data/file.txt')).toBe(true);
    expect(ig!.ignores('src/index.ts')).toBe(false);
    await fs.unlink(path.join(tmpDir, '.gitignore'));
  });
});

describe('createIgnoreFilter', () => {
  let tmpDir: string;

  beforeAll(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'gn-filter-test-'));
  });

  afterAll(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it('creates a filter with ignored and childrenIgnored methods', async () => {
    const filter = await createIgnoreFilter(tmpDir);
    expect(typeof filter.ignored).toBe('function');
    expect(typeof filter.childrenIgnored).toBe('function');
  });

  it('childrenIgnored returns true for hardcoded directories', async () => {
    const filter = await createIgnoreFilter(tmpDir);
    // Simulate a Path-like object
    const mockPath = { name: 'node_modules', relative: () => 'node_modules' } as any;
    expect(filter.childrenIgnored(mockPath)).toBe(true);

    const srcPath = { name: 'src', relative: () => 'src' } as any;
    expect(filter.childrenIgnored(srcPath)).toBe(false);
  });

  it('childrenIgnored returns true for gitignored directories', async () => {
    await fs.writeFile(path.join(tmpDir, '.gitignore'), 'local/\n');
    const filter = await createIgnoreFilter(tmpDir);

    const localPath = { name: 'local', relative: () => 'local' } as any;
    expect(filter.childrenIgnored(localPath)).toBe(true);

    const srcPath = { name: 'src', relative: () => 'src' } as any;
    expect(filter.childrenIgnored(srcPath)).toBe(false);

    await fs.unlink(path.join(tmpDir, '.gitignore'));
  });
});
