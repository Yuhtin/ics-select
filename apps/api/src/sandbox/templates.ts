import type { ChallengeLanguage } from '@ics-select/prisma';

/**
 * Starter code returned by `POST /me/challenges/start` so the editor opens
 * with a runnable scaffold instead of an empty file. The member edits in
 * place. Each template already reads everything from stdin and has a clear
 * marker showing where their code goes.
 *
 * Pattern: read first, work, print. Tokens-based for Python (split on any
 * whitespace) and stream-based for C++ (cin >>). Both match the stdin /
 * stdout test case format we use.
 */
const PYTHON_STARTER = `import sys

def main():
    data = sys.stdin.read().split()
    # Your code here. \`data\` is a list of whitespace-separated tokens.
    # Convert what you need:
    #   n = int(data[0])
    #   nums = [int(x) for x in data[1:1 + n]]
    print(0)

main()
`;

const CPP_STARTER = `#include <bits/stdc++.h>
using namespace std;

int main() {
    ios_base::sync_with_stdio(false);
    cin.tie(NULL);

    // Your code here. Read from cin, write to cout.
    //   int n; cin >> n;
    //   vector<int> v(n);
    //   for (int i = 0; i < n; i++) cin >> v[i];
    //   cout << v[0] << endl;

    return 0;
}
`;

export const STARTER_CODE: Record<ChallengeLanguage, string> = {
  PYTHON: PYTHON_STARTER,
  CPP: CPP_STARTER,
};

/** File name the member's code lands at inside /code in the sandbox. */
export const SOURCE_FILE_NAME: Record<ChallengeLanguage, string> = {
  PYTHON: 'main.py',
  CPP: 'main.cpp',
};
