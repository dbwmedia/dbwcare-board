/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

type Props = {
  isSignUp?: boolean;
};

export function TermsAndConditions(props: Props) {
  const { isSignUp = false } = props;
  return (
    <span className="flex flex-col items-center gap-3 py-6">
      <p className="text-center text-13 whitespace-pre-line text-secondary">
        {isSignUp ? "By creating an account" : "By signing in"}, you agree to our{" \n"}
        <a href="https://plane.so/legals/terms-and-conditions" target="_blank" rel="noopener noreferrer">
          <span className="text-13 font-medium underline hover:cursor-pointer">Terms of Service</span>
        </a>{" "}
        and{" "}
        <a href="https://plane.so/legals/privacy-policy" target="_blank" rel="noopener noreferrer">
          <span className="text-13 font-medium underline hover:cursor-pointer">Privacy Policy</span>
        </a>
        {"."}
      </p>
      <p className="text-11 text-tertiary">
        Ein Service von{" "}
        <a
          href="https://dbw-media.de"
          target="_blank"
          rel="noopener noreferrer"
          className="font-medium underline hover:text-secondary"
        >
          dbw media
        </a>
      </p>
    </span>
  );
}
