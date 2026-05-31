/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

// assets
import { useTranslation } from "@plane/i18n";
import { DBWCARE_VERSION } from "@/plane-web/constants/version";

export function PlaneVersionNumber() {
  const { t } = useTranslation();
  return (
    <span>
      {t("version")}: v{DBWCARE_VERSION}
    </span>
  );
}
