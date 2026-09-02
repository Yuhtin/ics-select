import { STARTER_CODE, SOURCE_FILE_NAME } from './templates';

describe('sandbox templates', () => {
  it('has a non-empty starter for every language', () => {
    expect(STARTER_CODE.PYTHON.length).toBeGreaterThan(20);
    expect(STARTER_CODE.CPP.length).toBeGreaterThan(20);
  });

  it('python starter reads stdin', () => {
    expect(STARTER_CODE.PYTHON).toMatch(/sys\.stdin/);
  });

  it('cpp starter includes iostream-equivalent header', () => {
    // bits/stdc++.h pulls in iostream + the rest of the STL.
    expect(STARTER_CODE.CPP).toMatch(/bits\/stdc\+\+\.h|<iostream>/);
    expect(STARTER_CODE.CPP).toMatch(/int main\(/);
  });

  it('maps each language to the source file the runner expects', () => {
    expect(SOURCE_FILE_NAME.PYTHON).toBe('main.py');
    expect(SOURCE_FILE_NAME.CPP).toBe('main.cpp');
  });
});
