<script lang="ts">
	import { cloud } from "$lib/cloud/api";
	import JoinPage from "$lib/cloud/JoinPage.svelte";
</script>

<JoinPage kind="invite" redeem={cloud.sharing.acceptInvite} />
