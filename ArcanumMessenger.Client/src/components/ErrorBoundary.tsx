import { Component, type ErrorInfo, type ReactNode } from "react";
import { navigateTo } from "../lib/navigation";

interface Props {
    children: ReactNode;
}

interface State {
    hasError: boolean;
}

export class ErrorBoundary extends Component<Props, State> {
    state: State = { hasError: false };

    static getDerivedStateFromError(): State {
        return { hasError: true };
    }

    componentDidCatch(error: Error, info: ErrorInfo) {
        sessionStorage.setItem(
            "lastServerError",
            JSON.stringify({
                status: 0,
                path: window.location.pathname,
                message: error.message || "Unexpected application error",
                timestamp: new Date().toISOString(),
            })
        );
        console.error("Render crash:", error, info.componentStack);
        navigateTo("/error", { replace: true });
    }

    render() {
        if (this.state.hasError) {
            return null;
        }
        return this.props.children;
    }
}