import { useEffect, useMemo, useState } from "react";
import {
  fetchMasterDataOptionsFromBackend,
  type MasterDataOption,
} from "./use-master-data-backend";
import { registerSaudiCityOptions } from "../shared/app-domain";

function mapOptionsToCityList(options: MasterDataOption[]): string[] {
  return Array.from(
    new Set(
      options
        .filter((option) => option.isActive)
        .map((option) => option.label.trim())
        .filter((city) => city.length > 0),
    ),
  );
}

export function useSaudiCityOptions(defaultOptions: readonly string[]): string[] {
  const normalizedDefaultOptions = useMemo(
    () =>
      Array.from(
        new Set(
          defaultOptions
            .map((city) => city.trim())
            .filter((city) => city.length > 0),
        ),
      ),
    [defaultOptions],
  );
  const [cityOptions, setCityOptions] = useState<string[]>(normalizedDefaultOptions);

  useEffect(() => {
    registerSaudiCityOptions(normalizedDefaultOptions);
  }, [normalizedDefaultOptions]);

  useEffect(() => {
    const controller = new AbortController();

    void fetchMasterDataOptionsFromBackend({
      categoryKey: "saudi-city",
      signal: controller.signal,
    })
      .then((options) => {
        if (controller.signal.aborted) {
          return;
        }

        const resolved = mapOptionsToCityList(options);
        if (resolved.length === 0) {
          return;
        }

        setCityOptions(resolved);
        registerSaudiCityOptions(resolved);
      })
      .catch(() => {
        if (controller.signal.aborted) {
          return;
        }

        setCityOptions(normalizedDefaultOptions);
      });

    return () => {
      controller.abort();
    };
  }, [normalizedDefaultOptions]);

  return cityOptions;
}
