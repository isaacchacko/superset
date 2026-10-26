export function DashboardSidebarEffortRoleCaption({
	label,
}: {
	label: string;
}) {
	return (
		<div className="pl-9 pr-2 pt-1 text-[10px] font-semibold uppercase tracking-[0.075em] text-muted-foreground/70">
			{label}
		</div>
	);
}
