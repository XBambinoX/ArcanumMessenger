import { useEffect, useState } from "react";
import styles from "./AvatarImage.module.css";

interface AvatarImageProps {
    src: string | null;
    fallback: string;
}

// Every avatar circle in the app already has its own sizing/background via
// the parent's own CSS class - this only decides what goes *inside* it: the
// real photo if there is one, the existing letter otherwise. A failed/404
// load (no avatar set) falls back the same way.
export default function AvatarImage({ src, fallback }: AvatarImageProps) {
    const [failed, setFailed] = useState(false);

    useEffect(() => {
        setFailed(false);
    }, [src]);

    if (!src || failed) {
        return <>{fallback}</>;
    }

    return <img className={styles.img} src={src} alt="" onError={() => setFailed(true)} />;
}
