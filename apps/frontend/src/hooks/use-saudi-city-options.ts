import { useEffect, useMemo } from "react";
import { type MasterDataOption } from "./use-master-data-backend";
import { useMasterDataOptionsQuery } from "./use-master-data-query";
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
    () => Array.from(new Set(defaultOptions.map((city) => city.trim()).filter((city) => city.length > 0))),
    [defaultOptions],
  );
  const saudiCityOptionsQuery = useMasterDataOptionsQuery({
    categoryKey: "saudi-city",
  });
  const cityOptions = useMemo(() => {
    const resolved = mapOptionsToCityList(saudiCityOptionsQuery.data ?? []);
    return resolved.length > 0 ? resolved : normalizedDefaultOptions;
  }, [normalizedDefaultOptions, saudiCityOptionsQuery.data]);

  useEffect(() => {
    registerSaudiCityOptions(cityOptions);
  }, [cityOptions]);

  return cityOptions;
}
