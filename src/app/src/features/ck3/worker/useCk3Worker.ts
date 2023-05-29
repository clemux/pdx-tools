import {useEffect, useState} from "react";
import {message} from "antd";
import {captureException} from "@/features/errors";
import {getErrorMessage} from "@/lib/getErrorMessage";
import {Ck3Worker, getCk3Worker} from "@/features/ck3/worker/index";

export const useCk3Worker = <T>(cb: (arg0: Ck3Worker) => Promise<T>) => {
    const [isLoading, setLoading] = useState(false);
    const [data, setData] = useState<T | undefined>(undefined);
    useEffect(() => {
        let mounted = true;

        async function getData() {
            try {
                if (mounted) {
                    setLoading(true);
                    const worker = getCk3Worker();
                    const result = await cb(worker);
                    if (mounted) {
                        setData(result);
                    }
                }
            } catch (error) {
                captureException(error);
                message.error(getErrorMessage(error));
            } finally {
                if (mounted) {
                    setLoading(false);
                }
            }
        }

        getData();

        return () => {
            mounted = false;
        };
    }, [cb])

    return {isLoading, data};
};
