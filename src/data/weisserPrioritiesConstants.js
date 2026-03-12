export const SECTIONS = [
    {
        label: "Weisser", color: "#3c6ef0",
        machines: [
            {
                id: "DRA10060", priorities: [
                    { component: "SGR", material: "M0153391/s", cancelled: false },
                    { component: "SG2", material: "M0153389/s", cancelled: false, defaultCurrent: true },
                ]
            },
            {
                id: "DRA10061", priorities: [
                    { component: "SG5", material: "M0155199/s", cancelled: false },
                    { component: "FG5-7", material: "M0155197/s", cancelled: false, defaultCurrent: true },
                ]
            },
            {
                id: "DRA10062", priorities: [
                    { component: "P.G.", material: "M0154996/s", cancelled: false, defaultCurrent: true },
                    { component: "SG8", material: "M0153397/s", cancelled: false },
                ]
            },
            {
                id: "DRA10065/66", priorities: [
                    { component: "SG4", material: "M0170686/s", cancelled: false },
                    { component: "SG5", material: "2511109051/s", cancelled: false, defaultCurrent: true },
                    { component: "SG5", material: "2511122951/s", cancelled: false },
                ]
            },
            {
                id: "DRA10067/68", priorities: [
                    { component: "SG3", material: "M0133401/s", cancelled: true },
                    { component: "DG2", material: "2511108350/s", cancelled: false },
                    { component: "DG2", material: "2511122350/s", cancelled: false, defaultCurrent: true },
                ]
            },
            {
                id: "DRA10069/70", priorities: [
                    { component: "SG6", material: "2511109250/s", cancelled: false },
                    { component: "SG7", material: "M0155201/s", cancelled: false },
                    { component: "SG6", material: "2511123150/s", cancelled: false, defaultCurrent: true },
                    { component: "SG6", material: "M0153387/s", cancelled: false },
                ]
            },
            {
                id: "DRA10071", priorities: [
                    { component: "SG3", material: "8Fe", cancelled: false, defaultCurrent: true },
                    { component: "", material: "2511109350/s", cancelled: true },
                    { component: "SGR", material: "M0153391/s", cancelled: false },
                    { component: "", material: "2511123250/s", cancelled: false },
                ]
            },
        ]
    },
    {
        label: "Laser", color: "#e05c2a",
        machines: [
            {
                id: "SCA11006", priorities: [
                    { component: "DG2", material: "2511124650/s", cancelled: false },
                    { component: "SGR", material: "M0162523/s", cancelled: false },
                    { component: "DG2", material: "2511108350/s", cancelled: false },
                    { component: "SG2", material: "M0153389/s", cancelled: false },
                    { component: "DG2", material: "2511122350/s", cancelled: false, defaultCurrent: true },
                ]
            },
            {
                id: "SCA11008", note: "Fine C", priorities: [
                    { component: "SG3", material: "M0153401/s", cancelled: false },
                    { component: "SG1", material: "2511108150/s", cancelled: false, defaultCurrent: true },
                    { component: "SG1", material: "2511124450/s", cancelled: false },
                    { component: "SGR", material: "M0153391/s", cancelled: false },
                ]
            },
            {
                id: "SCA11010", priorities: [
                    { component: "SG3", material: "M0153401/s", cancelled: false, defaultCurrent: true },
                    { component: "SGR", material: "2511109451/s", cancelled: false },
                    { component: "SG2", material: "M0153389/s", cancelled: false },
                ]
            },
            {
                id: "SCA10151", priorities: [
                    { component: "SG7", material: "M0155201/s", cancelled: false },
                    { component: "SG6", material: "M0153387/s", cancelled: false, defaultCurrent: true },
                    { component: "SG8", material: "M0153397/s", cancelled: false },
                ]
            },
            {
                id: "SCA11009", note: "Fine C", priorities: [
                    { component: "SG4", material: "2511124953/s", cancelled: false },
                    { component: "SG4", material: "M0170686/s", cancelled: false },
                    { component: "SG5", material: "M0155199/s", cancelled: false },
                    { component: "SG4", material: "2511122651/s", cancelled: false },
                    { component: "SG4", material: "2511108751/s", cancelled: false, defaultCurrent: true },
                ]
            },
            {
                id: "SCA11078", priorities: [
                    { component: "SG6", material: "2511125351", cancelled: false },
                    { component: "SG5", material: "2511125150", cancelled: false },
                    { component: "SG3", material: "M0162623/S", cancelled: false },
                    { component: "SG5", material: "M0162621", cancelled: false },
                    { component: "SG5", material: "2511108952", cancelled: false },
                    { component: "SG6", material: "2511109151", cancelled: false },
                    { component: "SG4", material: "M0162637", cancelled: false },
                    { component: "SG5", material: "2511122851", cancelled: false, defaultCurrent: true },
                    { component: "SG6", material: "2511123050", cancelled: false },
                ]
            },
        ]
    },
    {
        label: "Pfauter", color: "#2a9e6e",
        machines: [
            {
                id: "FRW11010", priorities: [
                    { component: "SG7", material: "M0155201/s", cancelled: false },
                    { component: "SG6", material: "M0153387/s", cancelled: false, defaultCurrent: true },
                ]
            },
            {
                id: "FRW10074", priorities: [
                    { component: "SG5", material: "2511125250/s", cancelled: false },
                    { component: "SG5", material: "2511122951/s", cancelled: false },
                    { component: "SG5", material: "2511109051/s", cancelled: false, defaultCurrent: true },
                ]
            },
            {
                id: "FRW10075", priorities: [
                    { component: "SG6", material: "2511125451/s", cancelled: false },
                    { component: "SG6", material: "2511109250/s", cancelled: false },
                    { component: "SG6", material: "2511123150/s", cancelled: false, defaultCurrent: true },
                ]
            },
            {
                id: "FRW10076", priorities: [
                    { component: "DG2", material: "2511124650/s", cancelled: false },
                    { component: "SG3", material: "M0162623/S", cancelled: false },
                    { component: "DG2", material: "2511108350/s", cancelled: false, defaultCurrent: true },
                    { component: "DG2", material: "2511122350/s", cancelled: false },
                ]
            },
            {
                id: "FRW10078", priorities: [
                    { component: "SG4", material: "2511124953/s", cancelled: false },
                    { component: "SG2", material: "M0162644/s", cancelled: false },
                    { component: "FG5-7", material: "M0155197/s", cancelled: false, defaultCurrent: true },
                    { component: "SG4", material: "2511122651/s", cancelled: false },
                    { component: "SG4", material: "2511108751/s", cancelled: false },
                ]
            },
            {
                id: "FRW10079", note: "Turno C", priorities: [
                    { component: "SG4", material: "M0170686/s", cancelled: false },
                    { component: "SGR", material: "M0162523/s", cancelled: false },
                    { component: "SG3", material: "M0153401/s", cancelled: false },
                ]
            },
            {
                id: "FRW82", priorities: [
                    { component: "SG5", material: "M0162622/s", cancelled: false, defaultCurrent: true },
                    { component: "SG5", material: "M0155199/s", cancelled: false },
                    { component: "P.G.", material: "M0154996/s", cancelled: false },
                ]
            },
        ]
    },
];

export const STORAGE_KEY = "weisser-priorities-v2";
