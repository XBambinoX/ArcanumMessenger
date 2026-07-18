// Temporary data for the New Chat panel - removed once a real
// contacts API exists.

export interface ContactSummary {
    id: string;
    username: string;
}

export const mockContacts: ContactSummary[] = [
    { id: "u-alice", username: "Alice" },
    { id: "u-bob", username: "Bob" },
    { id: "u-carol", username: "Carol" },
];
