import { create } from "zustand";
import { persist } from "zustand/middleware";

/** Efforts the sidebar shows expanded. An effort is collapsed until expanded. */
interface ExpandedEffortsState {
	expanded: Record<string, true>;
	toggle: (slug: string) => void;
}

export const useExpandedEffortsStore = create<ExpandedEffortsState>()(
	persist(
		(set) => ({
			expanded: {},
			toggle: (slug) =>
				set((state) => {
					const { [slug]: wasExpanded, ...rest } = state.expanded;
					return { expanded: wasExpanded ? rest : { ...rest, [slug]: true } };
				}),
		}),
		{ name: "vector-expanded-efforts" },
	),
);
