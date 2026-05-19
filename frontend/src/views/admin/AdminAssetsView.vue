<template>
  <div class="portal-shell">
    <section class="hero-band">
      <div>
        <p class="eyebrow">Asset Management</p>
        <h1>Admin Assets</h1>
      </div>
      <button type="button" class="secondary-button" :disabled="loading" @click="loadAssets">Refresh</button>
    </section>

    <ErrorBanner :message="errorMessage" />
    <AssetUploadForm
      :loading="uploading"
      :last-uploaded="lastUploaded"
      @upload="upload"
    />

    <div v-if="loading" class="panel empty-state">Loading assets...</div>
    <template v-else>
      <AssetVersionTable
        v-for="assetType in assetTypes"
        :key="assetType"
        :asset-type="assetType"
        :assets="assetsByType[assetType] || []"
        :active-version="activeByType[assetType]"
        :activating-version="activatingVersion"
        @activate="activate"
      />
    </template>
  </div>
</template>

<script>
import AssetUploadForm from '../../components/admin/AssetUploadForm.vue';
import AssetVersionTable from '../../components/admin/AssetVersionTable.vue';
import ErrorBanner from '../../components/ErrorBanner.vue';
import { activateAsset, getAdminErrorMessage, listAssets, uploadAsset } from '../../api/adminApi';

export default {
  name: 'AdminAssetsView',
  components: {
    AssetUploadForm,
    AssetVersionTable,
    ErrorBanner
  },
  data() {
    return {
      assetTypes: ['pr_model', 'contract_info', 'ecc_template'],
      assets: [],
      activeByType: {},
      loading: false,
      uploading: false,
      activatingVersion: '',
      lastUploaded: null,
      errorMessage: ''
    };
  },
  computed: {
    assetsByType() {
      return this.assets.reduce((groups, asset) => {
        if (!groups[asset.assetType]) groups[asset.assetType] = [];
        groups[asset.assetType].push(asset);
        return groups;
      }, {});
    }
  },
  mounted() {
    this.loadAssets();
  },
  methods: {
    async loadAssets() {
      this.loading = true;
      this.errorMessage = '';
      try {
        const result = await listAssets();
        this.assets = result.items || [];
        this.activeByType = result.activeByType || {};
      } catch (error) {
        this.errorMessage = getAdminErrorMessage(error);
      } finally {
        this.loading = false;
      }
    },
    async upload({ assetType, file }) {
      if (!assetType || !file) {
        this.errorMessage = 'Select an asset type and file first.';
        return;
      }
      this.uploading = true;
      this.errorMessage = '';
      try {
        this.lastUploaded = await uploadAsset({ assetType, file });
        await this.loadAssets();
      } catch (error) {
        this.errorMessage = getAdminErrorMessage(error);
      } finally {
        this.uploading = false;
      }
    },
    async activate(asset) {
      if (!window.confirm(`Activate ${asset.version} for ${asset.assetType}?`)) return;
      this.activatingVersion = asset.version;
      this.errorMessage = '';
      try {
        await activateAsset({
          assetType: asset.assetType,
          version: asset.version
        });
        await this.loadAssets();
      } catch (error) {
        this.errorMessage = getAdminErrorMessage(error);
      } finally {
        this.activatingVersion = '';
      }
    }
  }
};
</script>
