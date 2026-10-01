import { queryOptions, useQuery } from "@tanstack/react-query";
import { getSpaceWeather } from "./space-weather.functions";

export const weatherQuery = queryOptions({
  queryKey: ["space-weather"],
  queryFn: () => getSpaceWeather(),
  staleTime: 5 * 60 * 1000,
  refetchOnWindowFocus: false,
  retry: 1,
});

export const useSpaceWeather = () => useQuery(weatherQuery);
