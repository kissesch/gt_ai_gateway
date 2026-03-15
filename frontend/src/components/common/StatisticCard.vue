<template>
    <a-card class="statistic-card" :loading="loading" :body-style="{ padding: '20px' }">
        <div class="statistic-content">
            <div v-if="icon" class="statistic-icon" :style="{ backgroundColor: color + '15', color: color }">
                <component :is="icon" />
            </div>
            <div class="statistic-info">
                <div class="statistic-title">{{ title }}</div>
                <div class="statistic-value" :style="{ color: color }">
                    {{ displayValue }}
                    <span v-if="showSuffix" class="statistic-suffix">{{ suffix }}</span>
                </div>
                <div v-if="description" class="statistic-description">
                    {{ description }}
                </div>
            </div>
        </div>
    </a-card>
</template>

<script setup lang="ts">
import { computed, type Component } from 'vue';

interface Props {
    title: string;
    value: number | string | null;
    precision?: number;
    suffix?: string;
    icon?: Component;
    description?: string;
    loading?: boolean;
    color?: string;
}

const props = withDefaults(defineProps<Props>(), {
    precision: undefined,
    suffix: '',
    icon: undefined,
    description: '',
    loading: false,
    color: '#1890ff',
});

const displayValue = computed(() => {
    if (props.value === null || props.value === undefined || props.value === '') {
        return '-';
    }

    if (typeof props.value === 'number' && props.precision !== undefined) {
        return props.value.toFixed(props.precision);
    }
    return props.value;
});

const showSuffix = computed(() => {
    return displayValue.value !== '-' && !!props.suffix;
});
</script>

<style scoped>
.statistic-card {
    height: 100%;
}

.statistic-content {
    display: flex;
    align-items: flex-start;
    gap: 16px;
}

.statistic-icon {
    width: 48px;
    height: 48px;
    border-radius: 8px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 24px;
    flex-shrink: 0;
}

.statistic-info {
    flex: 1;
    min-width: 0;
}

.statistic-title {
    font-size: 14px;
    color: #8c8c8c;
    margin-bottom: 4px;
}

.statistic-value {
    font-size: 28px;
    font-weight: 600;
    line-height: 1.2;
}

.statistic-suffix {
    font-size: 14px;
    font-weight: normal;
    margin-left: 4px;
}

.statistic-description {
    font-size: 12px;
    color: #8c8c8c;
    margin-top: 8px;
}
</style>
