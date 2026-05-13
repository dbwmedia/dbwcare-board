/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import React from "react";
import Link from "next/link";
import { EAuthModes } from "@plane/constants";

interface TermsAndConditionsProps {
  authType?: EAuthModes;
}

const LEGAL_LINKS = {
  termsOfService: "https://plane.so/legals/terms-and-conditions",
  privacyPolicy: "https://plane.so/legals/privacy-policy",
} as const;

const MESSAGES = {
  [EAuthModes.SIGN_UP]: "By creating an account",
  [EAuthModes.SIGN_IN]: "By signing in",
} as const;

function LegalLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link href={href} className="text-secondary" target="_blank" rel="noopener noreferrer">
      <span className="text-13 font-medium underline hover:cursor-pointer">{children}</span>
    </Link>
  );
}

export function TermsAndConditions({ authType = EAuthModes.SIGN_IN }: TermsAndConditionsProps) {
  return (
    <div className="flex flex-col items-center gap-3">
      <p className="text-center text-13 whitespace-pre-line text-tertiary">
        {`${MESSAGES[authType]}, you understand and agree to \n our `}
        <LegalLink href={LEGAL_LINKS.termsOfService}>Terms of Service</LegalLink> and{" "}
        <LegalLink href={LEGAL_LINKS.privacyPolicy}>Privacy Policy</LegalLink>.
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
    </div>
  );
}
