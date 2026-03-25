import React, { useState, useCallback } from 'react';

type Validator<T> = (values: T) => Partial<Record<keyof T, string>>;

export function useForm<T>(initialValues: T, validator?: Validator<T>) {
  const [values, setValues] = useState<T>(initialValues);
  const [errors, setErrors] = useState<Partial<Record<keyof T, string>>>({});

  const resetForm = useCallback(() => {
    setValues(initialValues);
    setErrors({});
  }, [initialValues]);

  const validate = useCallback(() => {
    if (!validator) return true;
    const newErrors = validator(values);
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }, [validator, values]);

  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setValues(prev => ({ ...prev, [name]: value }));
    // Xóa lỗi của trường đang nhập khi người dùng thay đổi giá trị
    if (validator) {
        setErrors(prev => ({ ...prev, [name]: undefined }));
    }
  }, [validator]);

  const setFieldValue = useCallback((name: keyof T, value: any) => {
    setValues(prev => ({ ...prev, [name]: value }));
    if (validator) {
        setErrors(prev => ({ ...prev, [name]: undefined }));
    }
  }, [validator]);

  const setMapValue = useCallback((mapName: keyof T, key: string, value: any) => {
    setValues((prev: any) => ({
        ...prev,
        [mapName]: { ...(prev[mapName] || {}), [key]: value }
    }));
  }, []);

  const addToArray = useCallback((arrayName: keyof T, item: any) => {
    setValues((prev: any) => ({
        ...prev,
        [arrayName]: [...(prev[arrayName] || []), item]
    }));
  }, []);

  const removeFromArray = useCallback((arrayName: keyof T, index: number) => {
    setValues((prev: any) => ({
        ...prev,
        [arrayName]: (prev[arrayName] || []).filter((_: any, i: number) => i !== index)
    }));
  }, []);

  const updateInArray = useCallback((arrayName: keyof T, index: number, field: string, value: any) => {
    setValues((prev: any) => {
        const newArray = [...(prev[arrayName] || [])];
        if (newArray[index]) {
            newArray[index] = { ...newArray[index], [field]: value };
        }
        return { ...prev, [arrayName]: newArray };
    });
  }, []);

  return {
    values,
    errors,
    setValues,
    setErrors,
    resetForm,
    validate,
    handleChange,
    setFieldValue,
    setMapValue,
    addToArray,
    removeFromArray,
    updateInArray,
  };
}