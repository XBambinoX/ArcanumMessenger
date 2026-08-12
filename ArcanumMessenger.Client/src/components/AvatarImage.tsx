import { useEffect, useState } from "react";
import styles from "./AvatarImage.module.css";

interface AvatarImageProps {
    src: string | null;
    fallback: string;
    // Only ever reaches a real <img> - the fallback letter has nothing
    // underneath it worth opening.
    onImageClick?: () => void;
}

// Every avatar circle in the app already has its own sizing/background via
// the parent's own CSS class - this only decides what goes *inside* it: the
// real photo if there is one, the existing letter otherwise. A failed/404
// load (no avatar set) falls back the same way.
export default function AvatarImage({ src, fallback, onImageClick }: AvatarImageProps) {
    const [failed, setFailed] = useState(false);

    useEffect(() => {
        setFailed(false);
    }, [src]);

    if (!src || failed) {
        return <>{fallback}</>;
    }

    return (
        <img
            className={`${styles.img} ${onImageClick ? styles.clickable : ""}`}
            src={src}
            alt=""
            onClick={onImageClick}
            onError={() => setFailed(true)}
        />
    );
}
