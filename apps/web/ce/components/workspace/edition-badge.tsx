/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import packageJson from "package.json";

export function WorkspaceEditionBadge() {
  const planeVersion = (packageJson as Record<string, unknown>).planeUpstreamVersion as string | undefined;

  return (
    <span className="text-11 text-tertiary">
      von{" "}
      <a
        href="https://dbw-media.de"
        target="_blank"
        rel="noopener noreferrer"
        className="font-medium underline hover:text-secondary"
      >
        dbw media
      </a>
      <span className="ml-2 text-tertiary/50">
        v{packageJson.version}
        {planeVersion && ` (Plane ${planeVersion})`}
      </span>
    </span>
  );
}
