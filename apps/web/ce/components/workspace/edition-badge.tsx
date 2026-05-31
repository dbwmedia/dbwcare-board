/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useEffect, useState } from "react";
import { observer } from "mobx-react";
import { ArrowUpCircle } from "lucide-react";
import { EUserPermissions, EUserPermissionsLevel } from "@plane/constants";
import { useUserPermissions } from "@/hooks/store/user";
import packageJson from "package.json";

const PLANE_UPSTREAM_VERSION = (packageJson as Record<string, unknown>).planeUpstreamVersion as string | undefined;
const CACHE_KEY = "dbwcare_plane_latest_version";
const CACHE_TTL = 24 * 60 * 60 * 1000; // 24h

function compareVersions(current: string, latest: string): boolean {
  const c = current.replace(/^v/, "").split(".").map(Number);
  const l = latest.replace(/^v/, "").split(".").map(Number);
  for (let i = 0; i < Math.max(c.length, l.length); i++) {
    const cv = c[i] ?? 0;
    const lv = l[i] ?? 0;
    if (lv > cv) return true;
    if (lv < cv) return false;
  }
  return false;
}

export const WorkspaceEditionBadge = observer(function WorkspaceEditionBadge() {
  const [latestPlane, setLatestPlane] = useState<string | null>(null);
  const { allowPermissions } = useUserPermissions();

  const isAdmin = allowPermissions([EUserPermissions.ADMIN], EUserPermissionsLevel.WORKSPACE);

  useEffect(() => {
    if (!isAdmin || !PLANE_UPSTREAM_VERSION) return;

    // Check cache first
    try {
      const cached = localStorage.getItem(CACHE_KEY);
      if (cached) {
        const { version, timestamp } = JSON.parse(cached);
        if (Date.now() - timestamp < CACHE_TTL) {
          setLatestPlane(version);
          return;
        }
      }
    } catch {
      // ignore
    }

    // Fetch latest release from GitHub
    fetch("https://api.github.com/repos/makeplane/plane/releases/latest")
      .then((res) => res.json())
      .then((data) => {
        const tag = data?.tag_name?.replace(/^v/, "") || null;
        if (tag) {
          setLatestPlane(tag);
          localStorage.setItem(CACHE_KEY, JSON.stringify({ version: tag, timestamp: Date.now() }));
        }
      })
      .catch(() => {
        // silent — no network or rate limit
      });
  }, [isAdmin]);

  const hasUpdate = PLANE_UPSTREAM_VERSION && latestPlane && compareVersions(PLANE_UPSTREAM_VERSION, latestPlane);

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
        {PLANE_UPSTREAM_VERSION && ` (Plane ${PLANE_UPSTREAM_VERSION})`}
      </span>
      {isAdmin && hasUpdate && (
        <span className="ml-1.5 inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-1.5 py-0.5 text-[10px] font-medium text-amber-600">
          <ArrowUpCircle className="size-2.5" />
          Plane {latestPlane}
        </span>
      )}
    </span>
  );
});
