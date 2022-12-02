<template>
    <Page>
        <ActionBar>
            <Label text="Plugins Demo" />
        </ActionBar>

        <ScrollView>
            <StackLayout>
                <StackLayout v-for="demo in demos" :key="demo.name">
                    <Button :text="demo.name" @tap="goToDemo(demo.component)" />
                </StackLayout>
            </StackLayout>
        </ScrollView>
    </Page>
</template>

<script lang="ts">
import MotionActivityVue from './MotionActivity.vue';
const demos = [{ name: 'Motion Activity', path: 'motion-activity', component: MotionActivityVue }];

export default {
    data() {
        return {
            demos
        };
    },
    mounted() {},
    methods: {
        async goToDemo(component) {
            try {
                await this.$navigateTo(component, {
                    animated: true
                });
            } catch (err) {
                console.error(err, err.stack);
            }
        }
    }
};
</script>
